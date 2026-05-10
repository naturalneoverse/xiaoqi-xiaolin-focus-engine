const STORAGE_KEYS = require("../../config/storageKeys");
const momentScore = require("../../utils/momentScore");

Page({
  data: {
    rangeLabel: "",
    recordedCount: 0,
    finishedCount: 0,
    momentScore: 0,
    mascotText: "",
    distPriority: [],
    distWhom: [],
    distWhy: [],
  },

  onLoad(options) {
    wx.setNavigationBarTitle({ title: "时间编织报告" });
    const raw = options && options.weekStart ? decodeURIComponent(options.weekStart) : "";
    this.__weekMondayKey = raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : "";
    this.refreshReport();
  },

  onShow() {
    this.refreshReport();
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
    const mascotText = `这周你记下了 ${createdCount} 件事、做完了 ${doneCount} 件，真我时刻累计 ${ms} 次。辛苦了，也值得。`;
    this.setData({
      rangeLabel: momentScore.formatWeekRangeChinese(monday),
      recordedCount: createdCount,
      finishedCount: doneCount,
      momentScore: ms,
      mascotText,
      distPriority: dist.priority,
      distWhom: dist.whom,
      distWhy: dist.why,
    });
  },

  goPoster() {
    const key =
      this.__weekMondayKey && /^\d{4}-\d{2}-\d{2}$/.test(this.__weekMondayKey)
        ? this.__weekMondayKey
        : momentScore.weekMondayKey(momentScore.getIsoWeekMonday(new Date()));
    wx.navigateTo({
      url: `/pages/poster/index?weekStart=${encodeURIComponent(key)}`,
    });
  },

  onShareToFriend() {
    wx.showToast({
      title: "请使用微信分享",
      icon: "none",
      duration: 1400,
    });
  },
});
