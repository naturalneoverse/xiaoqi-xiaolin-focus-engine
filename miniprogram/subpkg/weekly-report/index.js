const STORAGE_KEYS = require("../../config/storageKeys");
const { requireLoginOnLoad } = require("../../utils/requireLogin");
const momentScore = require("../../utils/momentScore");
const mascotCopyClient = require("../../utils/mascotCopyClient");
const mascotCopyStats = require("../../utils/mascotCopyStats");
const mascotEngineClient = require("../../utils/mascotEngineClient");
const { raceResolve, MASCOT_ENGINE_TIMEOUT_MS } = require("../../utils/raceResolve");

/** 转给朋友 / 分享图内文案：引号已去除；句末标点按产品保留 */
const WEEKLY_SHARE_FRIEND_TITLES = [
  "存在就是时间。",
  "回到实事本身。",
  "生活世界是意义基底。",
  "用智慧爱自己，用行动爱世界。",
  "看见时间的质地，活出真实的样子。",
  "时间编织，看见你的生活质地。",
  "愿你在这里，成为更真实的自己。",
  "向内觉察，向外行动。",
];

/** 画布宽 750 与 rpx 对齐时，30rpx 对应 30px 字号 */
const SHARE_CAPTION_FONT_PX = 30;
const SHARE_CAPTION_LINE_HEIGHT = Math.ceil(SHARE_CAPTION_FONT_PX * 1.45);

/** 按最大宽度折行（canvas measureText），供分享卡片正文 */
function wrapShareCaptionLines(ctx, text, maxWidth) {
  const s = String(text || "").trim();
  if (!s) return [];
  const chars = Array.from(s);
  const lines = [];
  let line = "";
  chars.forEach((ch) => {
    const test = line + ch;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = ch;
    } else {
      line = test;
    }
  });
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

/** 分享卡片画布逻辑尺寸（5:4，与微信推荐 750×600 一致） */
const SHARE_CARD_W = 750;
const SHARE_CARD_H = 600;

Page({
  data: {
    rangeLabel: "",
    recordedCount: 0,
    finishedCount: 0,
    momentScore: 0,
    mascotText: "",
    mascotInfraError: false,
    distPriority: [],
    distWhom: [],
    distWhy: [],
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
    if (!requireLoginOnLoad()) return;
    wx.setNavigationBarTitle({ title: "时间编织报告" });
    const raw = options && options.weekStart ? decodeURIComponent(options.weekStart) : "";
    this.__weekMondayKey = raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : "";
    this.__weeklyShareCardTempPath = "";
    this.refreshReport();
  },

  onShow() {
    this.refreshReport();
    /** 预生成 5:4 分享图（朋友圈用）；文案用首条占位，与转朋友随机句无关 */
    wx.nextTick(() => {
      this.generateWeeklyShareCardImage(WEEKLY_SHARE_FRIEND_TITLES[0]).then((p) => {
        this.__weeklyShareCardTempPath = p || "";
      });
    });
  },

  onPullDownRefresh() {
    this.refreshReport().then(
      () => {
        wx.stopPullDownRefresh();
      },
      () => {
        wx.stopPullDownRefresh();
      }
    );
  },

  refreshReport() {
    let tasks = [];
    try {
      const raw = wx.getStorageSync(STORAGE_KEYS.TASKS_DATA);
      tasks = Array.isArray(raw) ? raw : [];
    } catch (e) {
      console.error("weekly-report getStorageSync", e);
      tasks = [];
    }
    const monday =
      momentScore.mondayDateFromKey(this.__weekMondayKey) || momentScore.getIsoWeekMonday(new Date());
    const refNow = new Date();
    const agg = momentScore.aggregateMomentScoreForWeek(tasks, monday, refNow);
    const { doneCount, momentScore: ms, distTasks } = agg;
    const createdCount = momentScore.countCreatedInWeek(tasks, monday);
    const dist = momentScore.distributionRatios(distTasks || []);
    const stats = mascotCopyStats.buildWeeklyTimeStats(tasks, monday, refNow);

    const baselineMascot = mascotCopyClient.composeLocalCopy("weekly_time", stats).text;
    this.setData({
      rangeLabel: momentScore.formatWeekRangeChinese(monday),
      recordedCount: createdCount,
      finishedCount: doneCount,
      momentScore: ms,
      distPriority: dist.priority,
      distWhom: dist.whom,
      distWhy: dist.why,
      mascotText: baselineMascot,
      mascotInfraError: false,
    });

    return raceResolve(
      mascotEngineClient.fetchMascotEngineWeeklyTime(stats),
      MASCOT_ENGINE_TIMEOUT_MS,
    )
      .then((t) => {
        if (t) {
          this.setData({
            mascotText: t,
            mascotInfraError: false,
          });
          return;
        }
        return mascotCopyClient.fetchMascotCopy("weekly_time", stats).then((res) => {
          if (res && res.text) {
            this.setData({
              mascotText: res.text,
              mascotInfraError: !!res.infraError,
            });
          }
        });
      })
      .catch((e) => {
        console.error("weekly-report mascot", e);
      });
  },

  goPoster() {
    const key =
      this.__weekMondayKey && /^\d{4}-\d{2}-\d{2}$/.test(this.__weekMondayKey)
        ? this.__weekMondayKey
        : momentScore.weekMondayKey(momentScore.getIsoWeekMonday(new Date()));
    wx.navigateTo({
      url: `/subpkg/poster/index?weekStart=${encodeURIComponent(key)}`,
    });
  },

  /**
   * 绘制 5:4 分享图：白底 + LOGO（相对原约放大一倍，超出高度时自动缩小以容纳文案）+ 文案在 LOGO 正下方；LOGO 与文案整体垂直居中。
   * @param {string} captionLine 卡片内随机句（与微信转发 title 无关）；空则仅画 LOGO
   */
  generateWeeklyShareCardImage(captionLine) {
    const W = SHARE_CARD_W;
    const H = SHARE_CARD_H;
    const caption = typeof captionLine === "string" ? captionLine.trim() : "";
    return new Promise((resolve) => {
      const finish = (path) => resolve(typeof path === "string" ? path : "");
      const query = wx.createSelectorQuery().in(this);
      query
        .select("#weeklyShareCardCanvas")
        .fields({ node: true, size: true })
        .exec((res) => {
          const first = res && res[0];
          if (!first || !first.node) {
            finish("");
            return;
          }
          const canvas = first.node;
          const dpr = 1;
          canvas.width = W * dpr;
          canvas.height = H * dpr;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            finish("");
            return;
          }
          ctx.scale(dpr, dpr);
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, W, H);

          const pad = 40;
          const gapLogoToText = 28;
          ctx.font = `400 ${SHARE_CAPTION_FONT_PX}px PingFang SC, sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "top";
          const textMaxW = W - pad * 2;
          const captionLines = caption ? wrapShareCaptionLines(ctx, caption, textMaxW) : [];
          const textBlockH = captionLines.length * SHARE_CAPTION_LINE_HEIGHT;

          const logoSrc = "/images/transparent background/logo.png";
          const img = canvas.createImage();
          img.onload = () => {
            try {
              const iw = img.width || 1;
              const ih = img.height || 1;
              const ar = iw / ih;
              /** 原 logo 框约 240，放大一倍目标 480；与文案一起在 600 高内垂直居中，放不下则缩小 logoBox */
              let logoBox = 480;
              let dw;
              let dh;
              for (;;) {
                dw = logoBox;
                dh = logoBox;
                if (ar >= 1) {
                  dh = logoBox / ar;
                } else {
                  dw = logoBox * ar;
                }
                const stackH = dh + (captionLines.length ? gapLogoToText + textBlockH : 0);
                if (stackH <= H - pad * 2 || logoBox <= 200) {
                  break;
                }
                logoBox -= 16;
              }

              const stackH = dh + (captionLines.length ? gapLogoToText + textBlockH : 0);
              /** 整块（LOGO+文案）在画布内垂直居中；左右仍用 pad 留白 */
              const topY = Math.max(0, (H - stackH) / 2);
              const dx = (W - dw) / 2;
              ctx.drawImage(img, dx, topY, dw, dh);

              if (captionLines.length) {
                ctx.fillStyle = "#475569";
                ctx.font = `400 ${SHARE_CAPTION_FONT_PX}px PingFang SC, sans-serif`;
                let ty = topY + dh + gapLogoToText;
                captionLines.forEach((ln) => {
                  ctx.fillText(ln, W / 2, ty);
                  ty += SHARE_CAPTION_LINE_HEIGHT;
                });
              }
            } catch (e) {
              console.warn("[weekly-report] share card draw", e);
            }

            wx.canvasToTempFilePath(
              {
                canvas,
                x: 0,
                y: 0,
                width: W,
                height: H,
                destWidth: W,
                destHeight: H,
                fileType: "png",
                quality: 1,
                success: (r) => finish((r && r.tempFilePath) || ""),
                fail: (err) => {
                  console.warn("[weekly-report] canvasToTempFilePath", err);
                  finish("");
                },
              },
              this
            );
          };
          img.onerror = (err) => {
            console.warn("[weekly-report] share logo load fail", err);
            finish("");
          };
          img.src = logoSrc;
        });
    });
  },

  /** 与海报「转朋友」一致：卡片打开登录页并带 shareUid，登录后走既有归因 */
  onShareAppMessage() {
    const shareRef = require("../../utils/shareReferrer");
    /** 随机句仅写入分享图；转发 title 为空；path / 溯源仍由 resolveLoginEntrancePath 决定 */
    const randomTitle =
      WEEKLY_SHARE_FRIEND_TITLES[Math.floor(Math.random() * WEEKLY_SHARE_FRIEND_TITLES.length)];
    const fallbackImage = "/images/transparent background/logo.png";
    /** 转发卡片不展示顶部 title，仅展示分享图（图内 LOGO 下方文案） */
    return {
      title: "",
      promise: Promise.all([
        this.generateWeeklyShareCardImage(randomTitle),
        shareRef.resolveLoginEntrancePath(),
      ]).then(([cardPath, path]) => ({
        title: "",
        path: path || "/pages/login/index",
        imageUrl: cardPath || fallbackImage,
      })),
    };
  },

  onShareTimeline() {
    const shareRef = require("../../utils/shareReferrer");
    const query =
      shareRef && typeof shareRef.buildTimelineShareQuerySync === "function"
        ? shareRef.buildTimelineShareQuerySync()
        : "";
    const randomTitle =
      WEEKLY_SHARE_FRIEND_TITLES[Math.floor(Math.random() * WEEKLY_SHARE_FRIEND_TITLES.length)];
    const fallbackImage = "/images/transparent background/logo.png";
    return {
      title: "",
      query: query || "",
      promise: this.generateWeeklyShareCardImage(randomTitle).then((cardPath) => ({
        title: "",
        query: query || "",
        imageUrl: cardPath || fallbackImage,
      })),
    };
  },
});
