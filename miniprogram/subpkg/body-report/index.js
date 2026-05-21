const STATUS_ICON_MAP = {
  身心满格: "/images/transparent background/good.png",
  状态平稳: "/images/transparent background/well.png",
  轻微失衡: "/images/transparent background/slow.png",
  需要调整: "/images/transparent background/care.png",
};

const STORAGE_KEYS = require("../../config/storageKeys");
const bodyStats = require("../../utils/bodyStats");
const momentScore = require("../../utils/momentScore");
const mascotCopyClient = require("../../utils/mascotCopyClient");
const mascotCopyStats = require("../../utils/mascotCopyStats");
const mascotEngineClient = require("../../utils/mascotEngineClient");
const { raceResolve, MASCOT_ENGINE_TIMEOUT_MS } = require("../../utils/raceResolve");
const { goMindHome } = require("../../utils/goTabHome");
const { requireLoginOnLoad } = require("../../utils/requireLogin");

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

  onLoad(options) {
    if (!requireLoginOnLoad()) return;
    wx.setNavigationBarTitle({ title: "身体边界报告" });
    const raw = options && options.weekStart ? decodeURIComponent(String(options.weekStart)) : "";
    this.__weekMondayKey = raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : "";
    this.loadWeeklyReport();
  },

  onShow() {
    this.loadWeeklyReport();
  },

  onPullDownRefresh() {
    this.loadWeeklyReport().then(
      () => {
        wx.stopPullDownRefresh();
      },
      () => {
        wx.stopPullDownRefresh();
      }
    );
  },

  loadWeeklyReport() {
    let start;
    let end;
    const mon = this.__weekMondayKey ? momentScore.mondayDateFromKey(this.__weekMondayKey) : null;
    if (mon) {
      start = mon;
      end = new Date(mon);
      end.setDate(mon.getDate() + 6);
      end.setHours(23, 59, 59, 999);
    } else {
      const r = bodyStats.getWeekRangeContaining(new Date());
      start = r.start;
      end = r.end;
    }
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
      const stats = mascotCopyStats.buildBodyWeekStats(allRecords, start, end);
      const localCare = mascotCopyClient.composeLocalCopy("body_week", stats).text;
      const emptyCard = {
        hasRecords: false,
        rangeText,
        reviewText: "本周尚未记录身体边界，开始第一次记录吧。",
        sleepStats: buildStatRows([], "sleep", SLEEP_OPTIONS),
        sportStats: buildStatRows([], "sport", SPORT_OPTIONS),
        signalStats: buildStatRows([], "signal", SIGNAL_OPTIONS),
        statusTitle: "待生成",
        statusDesc: "完成本周记录后会自动生成身体边界状态。",
        extremeLine: "",
        sleepNarrative: "",
        sportNarrative: "",
        signalNarrative: "",
        careText: localCare,
      };
      this.setData(emptyCard);
      this.syncStatusIcon();

      return raceResolve(
        mascotEngineClient.fetchMascotEngineBodyWeek(stats),
        MASCOT_ENGINE_TIMEOUT_MS,
      )
        .then((t) => {
          if (t) {
            this.setData({ careText: t });
            return;
          }
          return mascotCopyClient.fetchMascotCopy("body_week", stats).then((res) => {
            if (res && res.text) this.setData({ careText: res.text });
          });
        })
        .catch((e) => {
          console.error("body-report empty week mascot", e);
        });
    }

    const deduped = rep.deduped;
    const stats = mascotCopyStats.buildBodyWeekStats(allRecords, start, end);
    const baselineCare = rep.careText || mascotCopyClient.composeLocalCopy("body_week", stats).text;
    this.setData({
      hasRecords: true,
      rangeText,
      reviewText: `这周你记录了 ${rep.dayCount} 天，共提交 ${rep.totalSubmits} 次。`,
      sleepStats: buildStatRows(deduped, "sleep", SLEEP_OPTIONS),
      sportStats: buildStatRows(deduped, "sport", SPORT_OPTIONS),
      signalStats: buildStatRows(deduped, "signal", SIGNAL_OPTIONS),
      statusTitle: rep.finalStatusTitle,
      statusDesc: rep.statusDesc,
      extremeLine: rep.extremeLine || "",
      sleepNarrative: rep.sleepNarrative,
      sportNarrative: rep.sportNarrative,
      signalNarrative: rep.signalNarrative,
      careText: baselineCare,
    });
    this.syncStatusIcon();

    return raceResolve(
      mascotEngineClient.fetchMascotEngineBodyWeek(stats),
      MASCOT_ENGINE_TIMEOUT_MS,
    )
      .then((t) => {
        if (t) {
          this.setData({ careText: t });
          return;
        }
        return mascotCopyClient.fetchMascotCopy("body_week", stats).then((res) => {
          if (res && res.text) this.setData({ careText: res.text });
        });
      })
      .catch((e) => {
        console.error("body-report week mascot", e);
      });
  },

  syncStatusIcon() {
    const { statusTitle } = this.data;
    this.setData({
      statusIcon: STATUS_ICON_MAP[statusTitle] || STATUS_ICON_MAP["状态平稳"],
    });
  },

  goHome() {
    goMindHome();
  },
});
