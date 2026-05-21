const { QUADRANT_IDS } = require("../config/reflectionRecordSchema");
const { getQuadrantMeta, getQuadrantCardBg } = require("../config/reflectionTheme");
const reflectionManager = require("./reflectionManager");
const {
  buildGeneralClosingEcho,
  REPORT_COMBO_INTRO,
  REPORT_COMBO_OUTRO,
} = require("./reflectionReportNarrative");
const { assembleQuadrantEchoParagraphs, stripEmoji } = require("./reflectionReportAssembly");
const {
  fetchQuadrantCacheRows,
  buildReplyMapFromRows,
} = require("./reflectionArkCache");

const EMPTY_LABEL = "暂未填写";

/**
 * @param {object} record
 * @param {number} quadrantId
 * @returns {Promise<object>}
 */
async function buildQuadrantSection(record, quadrantId) {
  const meta = getQuadrantMeta(quadrantId);
  const entry = record ? reflectionManager.getQuadrantEntry(record, quadrantId) : null;
  const filled = record ? reflectionManager.isQuadrantComplete(record, quadrantId) : false;

  const section = {
    id: quadrantId,
    title: meta ? meta.title : `象限${quadrantId}`,
    subtitle: meta ? meta.subtitle : "",
    agentLabel: meta ? meta.agentLabel : "",
    accent: meta ? meta.accent : "#184061",
    bg: getQuadrantCardBg(quadrantId, filled),
    filled,
    completedAt: filled && entry ? entry.completedAt || "" : "",
    emptyLabel: EMPTY_LABEL,
    echoParagraphs: [],
  };

  if (!filled || !entry || !record) {
    return section;
  }

  try {
    const rows = await fetchQuadrantCacheRows(record.taskId, quadrantId);
    const cacheMap = buildReplyMapFromRows(rows);
    section.echoParagraphs = assembleQuadrantEchoParagraphs(
      quadrantId,
      entry.cardResponses,
      cacheMap,
    );
  } catch (e) {
    console.warn("[reflectionReport] assemble quadrant", quadrantId, e && (e.message || e));
    section.echoParagraphs = [
      {
        echoKey: `q${quadrantId}-err`,
        echoText: stripEmoji("这份象限的回响暂时未能完整呈现，可返回重新打开或再提交一次本象限。"),
      },
    ];
  }

  return section;
}

/**
 * @param {string} taskId
 * @returns {Promise<object|null>}
 */
async function buildReportViewModel(taskId) {
  if (!taskId) return null;
  const record = reflectionManager.findByTaskId(taskId);
  if (!record) {
    return {
      taskId: String(taskId),
      taskTitle: "未命名任务",
      reportTime: "",
      sections: QUADRANT_IDS.map((id) => ({
        id,
        title: getQuadrantMeta(id) ? getQuadrantMeta(id).title : `象限${id}`,
        subtitle: getQuadrantMeta(id) ? getQuadrantMeta(id).subtitle : "",
        agentLabel: getQuadrantMeta(id) ? getQuadrantMeta(id).agentLabel : "",
        accent: getQuadrantMeta(id) ? getQuadrantMeta(id).accent : "#184061",
        bg: getQuadrantCardBg(id, false),
        filled: false,
        completedAt: "",
        emptyLabel: EMPTY_LABEL,
        echoParagraphs: [],
      })),
      hasAnyQuadrant: false,
      generalEcho: null,
      reportIntro: "",
      reportOutro: "",
    };
  }

  const sections = await Promise.all(
    QUADRANT_IDS.map((id) => buildQuadrantSection(record, id)),
  );

  let generalEcho = null;
  if (reflectionManager.isAllQuadrantsComplete(record)) {
    try {
      generalEcho = buildGeneralClosingEcho().map((t) => stripEmoji(t));
    } catch (e) {
      console.warn("[reflectionReport] buildGeneralClosingEcho", e && (e.message || e));
      generalEcho = [stripEmoji("整卷回响暂时生成失败，其它象限内容不受影响。")];
    }
  }

  const hasAnyQuadrant = reflectionManager.getCompletedQuadrantIds(record).length > 0;
  return {
    taskId: record.taskId,
    taskTitle: record.taskTitle || "未命名任务",
    reportTime: record.latestCompletedAt || "",
    sections,
    hasAnyQuadrant,
    generalEcho,
    reportIntro: hasAnyQuadrant ? stripEmoji(REPORT_COMBO_INTRO) : "",
    reportOutro: hasAnyQuadrant ? stripEmoji(REPORT_COMBO_OUTRO) : "",
  };
}

function buildListItems() {
  return reflectionManager
    .listRecordsSorted()
    .filter((record) => reflectionManager.getCompletedQuadrantIds(record).length > 0)
    .map((record) => {
      const completedIds = reflectionManager.getCompletedQuadrantIds(record);
      return {
        taskId: record.taskId,
        taskTitle: record.taskTitle || "未命名任务",
        reportTime: record.latestCompletedAt || "",
        tags: completedIds.map((id) => {
          const meta = getQuadrantMeta(id);
          return {
            id,
            title: meta ? meta.title : `象限${id}`,
            accent: meta ? meta.accent : "#184061",
          };
        }),
      };
    });
}

module.exports = {
  EMPTY_LABEL,
  buildQuadrantSection,
  buildReportViewModel,
  buildListItems,
};
