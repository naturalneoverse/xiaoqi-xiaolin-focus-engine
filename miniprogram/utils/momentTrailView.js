const momentScore = require("./momentScore");

const DEFAULT_MAX_HISTORY_WEEKS = 48;

const MOMENT_TRAIL_INTRO_TEXT =
  "真我时刻 = 本周带「真我 / 合一 / 不二」标签的任务加权合计。它反映你为自己在意的事留出的空间，不是任务数。";

/**
 * 真我时刻轨迹：本周大卡 + 历史周纯列表（不含本周、无对比、无跳转）。
 * @param {object[]} tasks
 * @param {{ maxHistoryWeeks?: number }} [opts]
 */
function buildMomentTrailView(tasks, opts) {
  const list = Array.isArray(tasks) ? tasks : [];
  const maxHistory =
    opts && Number(opts.maxHistoryWeeks) > 0 ? Number(opts.maxHistoryWeeks) : DEFAULT_MAX_HISTORY_WEEKS;
  const refNow = new Date();
  const cur = momentScore.getCurrentWeekSummary(list, refNow);
  const curKey = cur.weekMondayKey;
  const curView = momentScore.buildMomentScoreView(cur.momentScore);

  const historyRows = [];
  momentScore.buildWeekSummaries(list).forEach((s) => {
    if (!s || !s.weekMondayKey || s.weekMondayKey === curKey) return;
    if (s.momentScore <= 0 && s.doneCount <= 0) return;
    const view = momentScore.buildMomentScoreView(s.momentScore);
    historyRows.push({
      weekMondayKey: s.weekMondayKey,
      rangeLabel: s.rangeLabel,
      displayText: view.displayText,
      unitText: view.unitText,
      footnote: view.footnote || "",
    });
  });

  return {
    introText: MOMENT_TRAIL_INTRO_TEXT,
    hasData: (Number(cur.momentScore) || 0) > 0 || historyRows.length > 0,
    currentWeek: {
      rangeLabel: cur.rangeLabel,
      displayText: curView.displayText,
      unitText: curView.unitText,
      footnote: curView.footnote || "",
    },
    historyRows: historyRows.slice(0, maxHistory),
  };
}

module.exports = {
  buildMomentTrailView,
  MOMENT_TRAIL_INTRO_TEXT,
  DEFAULT_MAX_HISTORY_WEEKS,
};
