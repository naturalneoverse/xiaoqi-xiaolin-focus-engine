const STORAGE_KEYS = require("../../config/storageKeys");
const momentScore = require("../../utils/momentScore");
const posterRenderer = require("../../utils/posterRenderer");

Page({
  data: {
    generating: true,
    previewSrc: "",
  },

  onLoad(options) {
    const raw = options && options.weekStart ? decodeURIComponent(options.weekStart) : "";
    this.__weekMondayKey = raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : "";
    this.__blind = posterRenderer.rollBlindBox();
    this.__canvasReady = false;
    this.__lastTempPath = "";
  },

  onReady() {
    this.initCanvasAndGenerate();
  },

  initCanvasAndGenerate() {
    const query = wx.createSelectorQuery().in(this);
    query
      .select("#posterCanvas")
      .fields({ node: true, size: true })
      .select("#posterLogoWork")
      .fields({ node: true, size: true })
      .exec((res) => {
        const first = res && res[0];
        const logoField = res && res[1];
        if (!first || !first.node) {
          this.__canvasReady = false;
          this.setData({ generating: false });
          this._failGenerate();
          return;
        }
        const canvas = first.node;
        this.__canvasNode = canvas;
        this.__logoWorkCanvas = logoField && logoField.node ? logoField.node : null;
        let dpr = 2;
        try {
          dpr = wx.getWindowInfo ? wx.getWindowInfo().pixelRatio || 2 : wx.getSystemInfoSync().pixelRatio || 2;
        } catch (e) {
          dpr = 2;
        }
        this.__dpr = dpr;
        const w = posterRenderer.POSTER_W;
        const h = posterRenderer.POSTER_H;
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          this.__canvasReady = false;
          this.setData({ generating: false });
          this._failGenerate();
          return;
        }
        ctx.scale(dpr, dpr);
        this.__ctx = ctx;
        this.__canvasReady = true;
        this.runGenerate();
      });
  },

  goBack() {
    this.__safeNavigateBack("/pages/sleep/index");
  },

  goHome() {
    this.__safeNavigateBack("/pages/sleep/index");
  },

  runGenerate() {
    if (!this.__canvasReady || !this.__ctx || !this.__canvasNode) {
      this._failGenerate();
      return;
    }
    this.setData({ generating: true });
    this._runGenerateInner().catch((e) => {
      console.error("poster generate", e);
      this._failGenerate();
    });
  },

  async _runGenerateInner() {
    const ctx = this.__ctx;
    const canvas = this.__canvasNode;
    let tasks = [];
    try {
      const raw = wx.getStorageSync(STORAGE_KEYS.TASKS_DATA);
      tasks = Array.isArray(raw) ? raw : [];
    } catch (e) {
      tasks = [];
    }
    const now = new Date();
    const monday =
      momentScore.mondayDateFromKey(this.__weekMondayKey) || momentScore.getIsoWeekMonday(now);
    const agg = momentScore.aggregateMomentScoreForWeek(tasks, monday, now);
    const ms = agg.momentScore;
    const streak = momentScore.getCompletionStreakDays(tasks, now);
    const blind = this.__blind || posterRenderer.rollBlindBox();
    this.__blind = blind;
    const palette = posterRenderer.PALETTES[blind.paletteIndex % posterRenderer.PALETTES.length];

    const lineColor = posterRenderer.hexToLineColorObj(palette.accent);
    let qrPath = "";
    try {
      if (wx.cloud) {
        const cf = await wx.cloud.callFunction({
          name: "quickstartFunctions",
          data: { type: "getUnlimitedPosterQr", lineColor },
        });
        const result = (cf && cf.result) || {};
        if (result.success && result.fileID) {
          const dl = await wx.cloud.downloadFile({ fileID: result.fileID });
          qrPath = (dl && dl.tempFilePath) || "";
        }
      }
    } catch (e) {
      qrPath = "";
    }

    const weekLabel = momentScore.formatWeekRangePoster(monday);
    const app = getApp();
    const logoSrc =
      (app && app.globalData && app.globalData.imageAssets && app.globalData.imageAssets.logo) ||
      "/images/transparent background/logo.png";
    await posterRenderer.drawPosterFrame(ctx, {
      palette,
      momentScore: ms,
      streakDays: streak,
      blind,
      qrTempPath: qrPath,
      createImage: () => canvas.createImage(),
      weekRangeText: weekLabel,
      logoSrc,
      logoProcessCanvas: this.__logoWorkCanvas || null,
    });

    const res = await new Promise((resolve, reject) => {
      wx.canvasToTempFilePath(
        {
          canvas,
          x: 0,
          y: 0,
          width: canvas.width,
          height: canvas.height,
          destWidth: posterRenderer.POSTER_W,
          destHeight: posterRenderer.POSTER_H,
          fileType: "png",
          quality: 1,
          success: resolve,
          fail: reject,
        },
        this
      );
    });
    const path = res.tempFilePath;
    this.__lastTempPath = path;
    this.setData({
      previewSrc: path,
      generating: false,
    });
  },

  _failGenerate() {
    this.setData({ generating: false });
    wx.showModal({
      title: "提示",
      content: "生成失败，请重试",
      showCancel: false,
      success: (r) => {
        if (r.confirm) {
          this.initCanvasAndGenerate();
        }
      },
    });
  },

  onRegenerate() {
    this.__blind = posterRenderer.rollBlindBox();
    this.runGenerate();
  },

  onSaveAlbum() {
    const src = this.__lastTempPath || this.data.previewSrc;
    if (!src) {
      wx.showToast({ title: "请稍候", icon: "none" });
      return;
    }
    wx.saveImageToPhotosAlbum({
      filePath: src,
      success: () => {
        wx.showToast({ title: "已保存", icon: "success" });
      },
      fail: (err) => {
        const msg = (err && err.errMsg) || "";
        if (msg.indexOf("auth deny") >= 0 || msg.indexOf("authorize") >= 0) {
          wx.openSetting({});
        } else {
          wx.showToast({ title: "保存失败", icon: "none" });
        }
      },
    });
  },

  onShareMoment() {
    const src = this.__lastTempPath || this.data.previewSrc;
    if (!src) {
      wx.showToast({ title: "请稍候", icon: "none" });
      return;
    }
    wx.saveImageToPhotosAlbum({
      filePath: src,
      success: () => {
        wx.showModal({
          title: "已保存到相册",
          content: "请打开微信朋友圈，从相册选择该图发布。",
          showCancel: false,
        });
      },
      fail: (err) => {
        const msg = (err && err.errMsg) || "";
        if (msg.indexOf("auth deny") >= 0 || msg.indexOf("authorize") >= 0) {
          wx.openSetting({});
        } else {
          wx.showToast({ title: "保存失败", icon: "none" });
        }
      },
    });
  },

  onShareAppMessage() {
    return {
      title: "看看你有多少真我时刻",
      path: "/pages/sleep/index",
    };
  },

  onShareTimeline() {
    const p = this.__lastTempPath || this.data.previewSrc;
    return {
      title: "看看你有多少真我时刻",
      query: "",
      imageUrl: p || "",
    };
  },
});
