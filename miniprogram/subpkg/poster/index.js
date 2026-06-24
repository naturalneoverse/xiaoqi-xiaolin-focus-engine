const STORAGE_KEYS = require("../../config/storageKeys");
const momentScore = require("../../utils/momentScore");
const dailyCheckIn = require("../../utils/dailyCheckIn");
const posterRenderer = require("../../utils/posterRenderer");

/**
 * 将 getTempFileURL 得到的 HTTPS 落到本地供 canvas 使用。
 * 常见失败：未在公众平台配置该 URL 的 downloadFile 合法域名 → downloadFile 失败 → 只能画渐变。
 */
/** 与当前运行版本一致生成太阳码；正式版开启 check_path 以校验落地页已发布 */
function buildPosterSunCodeCloudPayload(lineColor) {
  let envVersion = "release";
  try {
    const info = wx.getAccountInfoSync && wx.getAccountInfoSync();
    const ev = info && info.miniProgram && info.miniProgram.envVersion;
    if (ev === "develop" || ev === "trial" || ev === "release") {
      envVersion = ev;
    }
  } catch (e) {
    /* ignore */
  }
  const checkPath = envVersion === "release";
  return {
    type: "getUnlimitedPosterQr",
    lineColor,
    envVersion,
    checkPath,
  };
}

async function downloadPosterBgToLocal(tempFileURL, fileID) {
  if (!tempFileURL) return "";
  const localFromDownload = await new Promise((resolve) => {
    wx.downloadFile({
      url: tempFileURL,
      success: (res) => {
        if (res.statusCode === 200 && res.tempFilePath) {
          resolve(res.tempFilePath);
        } else {
          console.warn("[poster-bg] downloadFile status", res.statusCode, res);
          resolve("");
        }
      },
      fail: (err) => {
        console.warn("[poster-bg] downloadFile fail", err);
        resolve("");
      },
    });
  });
  if (localFromDownload) return localFromDownload;

  const fromGetImageInfo = await new Promise((resolve) => {
    wx.getImageInfo({
      src: tempFileURL,
      success: (info) => resolve((info && info.path) || ""),
      fail: (err) => {
        console.warn("[poster-bg] getImageInfo fail", err);
        resolve("");
      },
    });
  });
  if (fromGetImageInfo) return fromGetImageInfo;

  if (fileID && wx.cloud) {
    const fromCloud = await new Promise((resolve) => {
      wx.cloud.downloadFile({
        fileID,
        success: (res) => resolve((res && res.tempFilePath) || ""),
        fail: (err) => {
          console.warn("[poster-bg] cloud.downloadFile(fileID) fail", err);
          resolve("");
        },
      });
    });
    if (fromCloud) return fromCloud;
  }

  let host = "";
  try {
    host = new URL(tempFileURL).hostname;
  } catch (e) {
    /* ignore */
  }
  console.warn(
    "[poster-bg] 底图未落地本地；请在小程序后台「downloadFile 合法域名」加入:",
    host || "(解析 hostname 失败)"
  );
  return "";
}

Page({
  data: {
    generating: true,
    previewSrc: "",
  },

  onLoad(options) {
    try {
      const shareRef = require("../../utils/shareReferrer");
      if (shareRef.gateUnauthenticatedShareEntry(options)) {
        return;
      }
    } catch (e) {
      /* ignore */
    }
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
      .exec((res) => {
        const first = res && res[0];
        if (!first || !first.node) {
          this.__canvasReady = false;
          this.setData({ generating: false });
          this._failGenerate();
          return;
        }
        const canvas = first.node;
        this.__canvasNode = canvas;
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

  onPreviewImageError() {
    wx.showToast({ title: "预览加载失败", icon: "none" });
    this.setData({ previewSrc: "" });
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
    const streak = dailyCheckIn.getCheckInTotalDays();
    const blind = this.__blind || posterRenderer.rollBlindBox();
    this.__blind = blind;
    const paletteBase = posterRenderer.PALETTES[blind.paletteIndex % posterRenderer.PALETTES.length];
    const palette = { ...paletteBase };
    if (palette.cloudFileId && wx.cloud) {
      try {
        const cfBg = await wx.cloud.callFunction({
          name: "quickstartFunctions",
          data: { type: "getPosterBgUrl", fileID: palette.cloudFileId },
        });
        const bgRes = (cfBg && cfBg.result) || {};
        if (bgRes.success && bgRes.tempFileURL) {
          const localBg = await downloadPosterBgToLocal(bgRes.tempFileURL, palette.cloudFileId);
          if (localBg) {
            palette.image = localBg;
          }
        } else {
          console.warn("poster cloud bg url", bgRes.errMsg || bgRes);
        }
      } catch (e) {
        console.warn("poster cloud bg", e);
      }
    }

    const lineColor = posterRenderer.hexToLineColorObj(palette.accent);
    let qrPath = "";
    try {
      if (wx.cloud) {
        const cf = await wx.cloud.callFunction({
          name: "quickstartFunctions",
          data: buildPosterSunCodeCloudPayload(lineColor),
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

    await posterRenderer.drawPosterFrame(ctx, {
      palette,
      momentScore: ms,
      streakDays: streak,
      blind,
      qrTempPath: qrPath,
      createImage: () => canvas.createImage(),
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

  async onShareMoment() {
    const src = this.__lastTempPath || this.data.previewSrc;
    if (!src) {
      wx.showToast({ title: "请稍候", icon: "none" });
      return;
    }
    let entrancePath = "/pages/login/index";
    try {
      const shareRef = require("../../utils/shareReferrer");
      if (shareRef && typeof shareRef.resolveLoginEntrancePath === "function") {
        entrancePath = await shareRef.resolveLoginEntrancePath();
      }
    } catch (e) {
      /* ignore */
    }
    // 直接调起系统「分享图片」面板（含发朋友/朋友圈等），避免必须先存相册；失败或低版本无接口时回退存相册引导
    if (typeof wx.showShareImageMenu === "function") {
      wx.showShareImageMenu({
        path: src,
        entrancePath,
        fail: (err) => {
          console.warn("[poster] showShareImageMenu fail", err);
          this._savePosterThenMomentHint(src);
        },
      });
      return;
    }
    this._savePosterThenMomentHint(src);
  },

  /** 低版本或 showShareImageMenu 失败：沿用存相册 + 引导发朋友圈 */
  _savePosterThenMomentHint(filePath) {
    wx.saveImageToPhotosAlbum({
      filePath,
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
    const shareRef = require("../../utils/shareReferrer");
    const title = "扫我，看看你有多少真我时刻";
    const imageUrl = this.__lastTempPath || this.data.previewSrc || "";
    return {
      title,
      promise: shareRef.resolveLoginEntrancePath().then((path) => ({
        title,
        path: path || "/pages/login/index",
        imageUrl,
      })),
    };
  },

  onShareTimeline() {
    const p = this.__lastTempPath || this.data.previewSrc;
    const shareRef = require("../../utils/shareReferrer");
    const query =
      shareRef && typeof shareRef.buildTimelineShareQuerySync === "function"
        ? shareRef.buildTimelineShareQuerySync()
        : "";
    return {
      title: "扫我，看看你有多少真我时刻",
      query: query || "",
      imageUrl: p || "",
    };
  },
});
