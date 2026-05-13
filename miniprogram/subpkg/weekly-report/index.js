const STORAGE_KEYS = require("../../config/storageKeys");
const momentScore = require("../../utils/momentScore");
const mascotCopyClient = require("../../utils/mascotCopyClient");
const mascotCopyStats = require("../../utils/mascotCopyStats");
const mascotEngineClient = require("../../utils/mascotEngineClient");
const { raceResolve, MASCOT_ENGINE_TIMEOUT_MS } = require("../../utils/raceResolve");

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
    wx.setNavigationBarTitle({ title: "时间编织报告" });
    const raw = options && options.weekStart ? decodeURIComponent(options.weekStart) : "";
    this.__weekMondayKey = raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : "";
    this.refreshReport();
  },

  onShow() {
    this.refreshReport();
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

  onShareToFriend() {
    wx.showToast({
      title: "请使用微信分享",
      icon: "none",
      duration: 1400,
    });
  },
});
