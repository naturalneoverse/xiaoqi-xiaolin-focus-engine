const { QUADRANT_IDS } = require("../config/reflectionRecordSchema");
const { getQuadrantMeta, getQuadrantCardBg } = require("../config/reflectionTheme");
const reflectionManager = require("./reflectionManager");
const {
  buildQuadrantEchoParagraphs,
  buildGeneralClosingEcho,
  REPORT_COMBO_INTRO,
  REPORT_COMBO_OUTRO,
} = require("./reflectionReportNarrative");

const EMPTY_LABEL = "暂未填写";

function buildQuadrantSection(record, quadrantId) {
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
    /** @type {{ echoKey: string, echoText: string }[]} 每段含「你说：」原话摘要 + 回响；不展示题目原文 */
    echoParagraphs: [],
  };

  if (filled && entry) {
    let paras;
    try {
      paras = buildQuadrantEchoParagraphs(quadrantId, entry.cardResponses);
    } catch (e) {
      console.warn("[reflectionReport] buildQuadrantEchoParagraphs", quadrantId, e && (e.message || e));
      paras = ["这份象限的回响生成时出了点小状况，可返回重新打开或再提交一次本象限。"];
    }
    if (!Array.isArray(paras) || !paras.length) {
      paras = ["啥也没写？那就不生成，不打扰。"];
    }
    section.echoParagraphs = paras.map((raw, idx) => {
      const t = typeof raw === "string" ? raw : raw != null ? String(raw) : "";
      return {
        echoKey: `q${quadrantId}-${idx}`,
        echoText: t,
      };
    });
  }
  return section;
}

/**
 * @param {string} taskId
 * @returns {{ taskId: string, taskTitle: string, reportTime: string, sections: object[], hasAnyQuadrant: boolean, generalEcho: string[]|null, reportIntro: string, reportOutro: string }|null}
 */
function buildReportViewModel(taskId) {
  if (!taskId) return null;
  const record = reflectionManager.findByTaskId(taskId);
  if (!record) {
    return {
      taskId: String(taskId),
      taskTitle: "未命名任务",
      reportTime: "",
      sections: QUADRANT_IDS.map((id) => buildQuadrantSection(null, id)),
      hasAnyQuadrant: false,
      generalEcho: null,
      reportIntro: "",
      reportOutro: "",
    };
  }

  const sections = QUADRANT_IDS.map((id) => buildQuadrantSection(record, id));
  let generalEcho = null;
  if (reflectionManager.isAllQuadrantsComplete(record)) {
    try {
      generalEcho = buildGeneralClosingEcho();
    } catch (e) {
      console.warn("[reflectionReport] buildGeneralClosingEcho", e && (e.message || e));
      generalEcho = ["整卷回响暂时生成失败，其它象限内容不受影响。"];
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
    reportIntro: hasAnyQuadrant ? REPORT_COMBO_INTRO : "",
    reportOutro: hasAnyQuadrant ? REPORT_COMBO_OUTRO : "",
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
