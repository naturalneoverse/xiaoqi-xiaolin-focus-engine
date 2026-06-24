const STATUS_ICON_MAP = {
  身心满格: "/images/transparent background/good.png",
  状态平稳: "/images/transparent background/well.png",
  轻微失衡: "/images/transparent background/slow.png",
  需要调整: "/images/transparent background/care.png",
};

const STORAGE_KEYS = require("../../config/storageKeys");
const bodyStats = require("../../utils/bodyStats");
const momentScore = require("../../utils/momentScore");
const mascotCopyStats = require("../../utils/mascotCopyStats");
const mascotCopyClient = require("../../utils/mascotCopyClient");
const bodyWeekArchive = require("../../utils/bodyWeekArchive");
const bodyWeekReportCare = require("../../utils/bodyWeekReportCare");
const { goMindHome } = require("../../utils/goTabHome");
const layoutFixture = require("../../config/bodyReportLayoutFixture");

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
    layoutFixtureBanner: "",
    careLoading: false,
  },

  onLoad(options) {
    wx.setNavigationBarTitle({ title: "身体边界报告" });
    const raw = options && options.weekStart ? decodeURIComponent(String(options.weekStart)) : "";
    this.__weekMondayKey = raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : "";
    this.__layoutFixtureVariant = layoutFixture.resolveLayoutFixtureVariant(options || {});
    this.__careSeq = 0;
    this.loadWeeklyReport();
  },

  onShow() {
    this.loadWeeklyReport();
  },

  onPullDownRefresh() {
    this.loadWeeklyReport().then(
      () => wx.stopPullDownRefresh(),
      () => wx.stopPullDownRefresh(),
    );
  },

  applyLayoutFixturePatch(base) {
    const fx = layoutFixture.getLayoutFixture(this.__layoutFixtureVariant || "1");
    if (!fx) return base;
    console.info("[body-report] layoutFixture", fx.meta);
    return Object.assign({}, base, {
      statusTitle: fx.statusTitle,
      statusDesc: fx.statusDesc,
      careText: fx.careText,
      extremeLine: fx.extremeLine || base.extremeLine || "",
      layoutFixtureBanner: fx.banner,
    });
  },

  loadWeeklyReport() {
    if (this.__layoutFixtureVariant) {
      wx.setNavigationBarTitle({ title: "身体边界报告·压测" });
    }

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

    const weekKey = momentScore.weekMondayKey(start);
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
        layoutFixtureBanner: "",
      };
      if (this.__layoutFixtureVariant) {
        this.setData(this.applyLayoutFixturePatch(emptyCard));
        this.syncStatusIcon();
        return Promise.resolve();
      }
      this.setData(emptyCard);
      this.syncStatusIcon();
      return Promise.resolve();
    }

    const stats = mascotCopyStats.buildBodyWeekStats(allRecords, start, end);
    const entry = bodyWeekArchive.getEntry(weekKey);
    const plan = bodyWeekReportCare.resolveCarePlan(weekKey, rep, entry);
    const instant = bodyWeekReportCare.buildRuleCareCopy(stats, rep);

    let statusDesc = rep.statusDesc;
    let careText = instant.careText;

    if (plan.mode === "archive_readonly" || plan.mode === "archive_hit") {
      const archived = bodyWeekReportCare.copyFromArchive(plan.entry);
      statusDesc = archived.statusDesc || statusDesc;
      careText = archived.careText || careText;
    } else if (
      plan.mode === "close_week" &&
      bodyWeekReportCare.canPromoteOpenModelClosure(plan.entry, plan.statsHash)
    ) {
      const archived = bodyWeekReportCare.copyFromArchive(plan.entry);
      statusDesc = archived.statusDesc || statusDesc;
      careText = archived.careText || careText;
    }

    const deduped = rep.deduped;
    const filledCard = {
      hasRecords: true,
      rangeText,
      reviewText: `这周您记录了 ${rep.dayCount} 天，共提交 ${rep.totalSubmits} 次。`,
      sleepStats: buildStatRows(deduped, "sleep", SLEEP_OPTIONS),
      sportStats: buildStatRows(deduped, "sport", SPORT_OPTIONS),
      signalStats: buildStatRows(deduped, "signal", SIGNAL_OPTIONS),
      statusTitle: rep.finalStatusTitle,
      statusDesc,
      extremeLine: rep.extremeLine || "",
      sleepNarrative: rep.sleepNarrative,
      sportNarrative: rep.sportNarrative,
      signalNarrative: rep.signalNarrative,
      careText,
      layoutFixtureBanner: "",
    };

    if (this.__layoutFixtureVariant) {
      this.setData(this.applyLayoutFixturePatch(filledCard));
      this.syncStatusIcon();
      return Promise.resolve();
    }

    this.setData(filledCard);
    this.syncStatusIcon();

    if (plan.mode === "archive_readonly" || plan.mode === "archive_hit") {
      return Promise.resolve();
    }

    if (
      plan.mode === "close_week" &&
      bodyWeekReportCare.canPromoteOpenModelClosure(plan.entry, plan.statsHash)
    ) {
      bodyWeekReportCare.promoteOpenEntryToClosed(weekKey, plan.entry, rep);
      return Promise.resolve();
    }

    const seq = (this.__careSeq || 0) + 1;
    this.__careSeq = seq;
    const archiveClosed = plan.mode === "close_week";
    this.setData({ careLoading: true });

    console.info("[body-report] carePlan", {
      weekKey,
      mode: plan.mode,
      statsHash: plan.statsHash.slice(0, 12),
      validDayCount: plan.validDayCount,
    });

    return bodyWeekReportCare
      .runCarePipeline({
        weekKey,
        rep,
        stats,
        planMode: plan.mode,
        archiveClosed,
        allRecords,
        weekStart: start,
        weekEnd: end,
      })
      .then((result) => {
        if (seq !== this.__careSeq) return;
        this.setData({
          careLoading: false,
          statusDesc: result.statusDesc || this.data.statusDesc,
          careText: result.careText || this.data.careText,
        });
      })
      .catch(() => {
        if (seq !== this.__careSeq) return;
        this.setData({ careLoading: false });
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
