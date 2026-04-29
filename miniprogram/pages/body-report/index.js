const STATUS_ICON_MAP = {
  身心满格: "/images/transparent background/good.png",
  状态平稳: "/images/transparent background/well.png",
  轻微失衡: "/images/transparent background/slow.png",
  需要调整: "/images/transparent background/care.png",
};

const STORAGE_KEYS = require("../../config/storageKeys");
const { getRecordScore, getWeekStatus, WEEK_CARE_TEXT } = require("../../config/bodyFeedback");

const SLEEP_OPTIONS = ["睡得香", "做梦了", "睡不实", "睡不着"];
const SPORT_OPTIONS = ["动够了", "动了点", "没咋动", "动过头了"];
const SIGNAL_OPTIONS = ["没事", "有劲", "累了", "疼了"];

function getCurrentWeekRange() {
  const now = new Date();
  const currentDay = now.getDay();
  const distanceToMonday = currentDay === 0 ? 6 : currentDay - 1;
  const start = new Date(now);
  start.setDate(now.getDate() - distanceToMonday);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function parseDateKeyToDate(dateKey) {
  if (!dateKey || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null;
  const date = new Date(`${dateKey}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatRangeText(start, end) {
  return `${start.getMonth() + 1}月${start.getDate()}日 — ${end.getMonth() + 1}月${end.getDate()}日`;
}

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

function resolveCareText(records, averageScore) {
  if (averageScore >= 70) return WEEK_CARE_TEXT.overallGood;
  const signalWorst = records.filter((item) => item.signal === "累了" || item.signal === "疼了").length;
  const sleepWorst = records.filter((item) => item.sleep === "睡不着" || item.sleep === "睡不实").length;
  const sportLeast = records.filter((item) => item.sport === "没咋动").length;
  const maxCount = Math.max(signalWorst, sleepWorst, sportLeast);
  if (maxCount === signalWorst) return WEEK_CARE_TEXT.signalWorst;
  if (maxCount === sleepWorst) return WEEK_CARE_TEXT.sleepWorst;
  return WEEK_CARE_TEXT.sportLeast;
}

Page({
  data: {
    hasRecords: false,
    rangeText: "",
    reviewText: "本周暂无身体记录，先去完成一次身体问答吧。",
    sleepStats: [],
    sportStats: [],
    signalStats: [],
    statusTitle: "待生成",
    statusDesc: "完成本周记录后会自动生成身体边界状态。",
    statusIcon: "/images/transparent background/good.png",
    careText: "先记录一次今天的身心状态，我们再一起看趋势。",
  },

  onLoad() {
    this.loadWeeklyReport();
  },

  onShow() {
    this.loadWeeklyReport();
  },

  loadWeeklyReport() {
    const { start, end } = getCurrentWeekRange();
    const rangeText = formatRangeText(start, end);
    const saved = wx.getStorageSync(STORAGE_KEYS.BODY_RECORDS);
    const allRecords = Array.isArray(saved) ? saved : [];
    const weekRecords = allRecords.filter((item) => {
      const date = parseDateKeyToDate(item && item.dateKey);
      return date && date >= start && date <= end;
    });

    if (!weekRecords.length) {
      this.setData({
        hasRecords: false,
        rangeText,
        reviewText: "本周暂无记录，先去完成一次身体问答吧。",
        sleepStats: buildStatRows([], "sleep", SLEEP_OPTIONS),
        sportStats: buildStatRows([], "sport", SPORT_OPTIONS),
        signalStats: buildStatRows([], "signal", SIGNAL_OPTIONS),
        statusTitle: "待生成",
        statusDesc: "完成本周记录后会自动生成身体边界状态。",
        careText: "先记录一次今天的状态，慢慢建立你的身体节奏。",
      });
      this.syncStatusIcon();
      return;
    }

    const totalScore = weekRecords.reduce((sum, item) => sum + getRecordScore(item), 0);
    const averageScore = Math.round(totalScore / weekRecords.length);
    const status = getWeekStatus(averageScore);
    const dayCount = new Set(weekRecords.map((item) => item.dateKey)).size;
    const reviewText = `这周你记录了 ${dayCount} 天，共 ${weekRecords.length} 次。`;

    this.setData({
      hasRecords: true,
      rangeText,
      reviewText,
      sleepStats: buildStatRows(weekRecords, "sleep", SLEEP_OPTIONS),
      sportStats: buildStatRows(weekRecords, "sport", SPORT_OPTIONS),
      signalStats: buildStatRows(weekRecords, "signal", SIGNAL_OPTIONS),
      statusTitle: status.title,
      statusDesc: status.desc,
      careText: resolveCareText(weekRecords, averageScore),
    });
    this.syncStatusIcon();
  },

  syncStatusIcon() {
    const { statusTitle } = this.data;
    this.setData({
      statusIcon: STATUS_ICON_MAP[statusTitle] || STATUS_ICON_MAP["状态平稳"],
    });
  },

  goBack() {
    wx.switchTab({
      url: "/pages/index/index",
    });
  },

  goHome() {
    wx.switchTab({
      url: "/pages/index/index",
    });
  },
});
