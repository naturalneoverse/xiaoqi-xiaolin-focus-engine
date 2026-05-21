/**
 * 任务答题：组合码 + 云端 taskReply（经 getReply 云函数，前端不存 64 组文案）
 */

const { fetchGetReply, buildInsightLine } = require("./getReplyClient");

function buildQuizCode(priorityId, circleId, layerId) {
  const p = Number(priorityId);
  const c = Number(circleId);
  const l = Number(layerId);
  if (![p, c, l].every((n) => n >= 1 && n <= 4)) return "";
  return `${p}${c}${l}`;
}

/**
 * @param {string} code
 * @returns {Promise<{ code, fullPrefix, reply, fullText, type1Name, type2Name, type3Name, errMsg? }|null>}
 */
function fetchTaskQuizCopy(code) {
  return fetchGetReply(code).then((res) => {
    if (!res.success) {
      return res.errMsg ? { errMsg: res.errMsg } : null;
    }
    return res.data;
  });
}

/**
 * 心境一语：优先用云端返回的三类名称，不另请求写库
 */
function fetchTaskQuizInsight(code, labels, cloudRecord) {
  if (cloudRecord && (cloudRecord.type1Name || cloudRecord.type2Name || cloudRecord.type3Name)) {
    return Promise.resolve(buildInsightLine(cloudRecord));
  }
  const c = String(code || "").trim();
  if (!/^[1-4]{3}$/.test(c)) {
    return Promise.resolve(null);
  }
  const fallback = labels
    ? buildInsightLine({
        type1Name: labels.priority,
        type2Name: labels.circle,
        type3Name: labels.layer,
      })
    : "";
  return Promise.resolve(fallback || "小麒看见，这三枚标签已经轻轻落在同一件事上了。");
}

module.exports = {
  buildQuizCode,
  fetchTaskQuizCopy,
  fetchTaskQuizInsight,
};
