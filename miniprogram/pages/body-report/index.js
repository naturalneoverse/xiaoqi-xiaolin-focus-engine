const STATUS_ICON_MAP = {
  身心满格: "/images/transparent background/good.png",
  状态平稳: "/images/transparent background/well.png",
  轻微失衡: "/images/transparent background/slow.png",
  需要调整: "/images/transparent background/care.png",
};

const STORAGE_KEYS = require("../../config/storageKeys");
const bodyStats = require("../../utils/bodyStats");
const momentScore = require("../../utils/momentScore");

const SLEEP_OPTIONS = bodyStats.SLEEP_OPTIONS;
const SPORT_OPTIONS = bodyStats.SPORT_OPTIONS;
const SIGNAL_OPTIONS = bodyStats.SIGNAL_OPTIONS;

function buildStatRows(records, field, options) {
  const total = records.length || 1;
  return options.map((label) => {
    const count = records.filter((item) => item[field] === label).length;
    const percent = Math.round((count / total) * 100);
    return {
      label,
      percentText: `${percent}%`,
      widthStyle: `width: ${percent}%;`,
    };
  });
}

Page({
  data: {
    hasRecords: false,
    rangeText: "",
    reviewText: "",
    sleepStats: [],
    sportStats: [],
    signalStats: [],
    statusTitle: "待生成",
    statusDesc: "",
    statusIcon: "/images/transparent background/good.png",
    careText: "",
    extremeLine: "",
    sleepNarrative: "",
    sportNarrative: "",
    signalNarrative: "",
  },

  onLoad() {
    wx.setNavigationBarTitle({ title: "身体边界报告" });
    this.loadWeeklyReport();
  },

  onShow() {
    this.loadWeeklyReport();
  },

  loadWeeklyReport() {
    const { start, end } = bodyStats.getWeekRangeContaining(new Date());
    const rangeText = momentScore.formatCalendarRangeChinese(start, end);
    let allRecords = [];
    try {
      const saved = wx.getStorageSync(STORAGE_KEYS.BODY_RECORDS);
      allRecords = Array.isArray(saved) ? saved : [];
    } catch (e) {
      console.error("body-report getStorageSync", e);
      allRecords = [];
    }

    const rep = bodyStats.buildWeekReportPayload(allRecords, start, end);

    if (!rep.hasRecords) {
      this.setData({
        hasRecords: false,
        rangeText,
        reviewText: "本周尚未记录身体边界，开始第一次记录吧。",
        sleepStats: buildStatRows([], "sleep", SLEEP_OPTIONS),
        sportStats: buildStatRows([], "sport", SPORT_OPTIONS),
        signalStats: buildStatRows([], "signal", SIGNAL_OPTIONS),
        statusTitle: "待生成",
        statusDesc: "完成本周记录后会自动生成身体边界状态。",
        careText: "先记录一次今天的身心状态，我们再一起看趋势。",
        extremeLine: "",
        sleepNarrative: "",
        sportNarrative: "",
        signalNarrative: "",
      });
      this.syncStatusIcon();
      return;
    }

    const deduped = rep.deduped;
    this.setData({
      hasRecords: true,
      rangeText,
      reviewText: `这周你记录了 ${rep.dayCount} 天，共提交 ${rep.totalSubmits} 次。`,
      sleepStats: buildStatRows(deduped, "sleep", SLEEP_OPTIONS),
      sportStats: buildStatRows(deduped, "sport", SPORT_OPTIONS),
      signalStats: buildStatRows(deduped, "signal", SIGNAL_OPTIONS),
      statusTitle: rep.finalStatusTitle,
      statusDesc: rep.statusDesc,
      careText: rep.careText,
      extremeLine: rep.extremeLine || "",
      sleepNarrative: rep.sleepNarrative,
      sportNarrative: rep.sportNarrative,
      signalNarrative: rep.signalNarrative,
    });
    this.syncStatusIcon();
  },

  syncStatusIcon() {
    const { statusTitle } = this.data;
    this.setData({
      statusIcon: STATUS_ICON_MAP[statusTitle] || STATUS_ICON_MAP["状态平稳"],
    });
  },

  goHome() {
    wx.switchTab({
      url: "/pages/index/index",
    });
  },
});
