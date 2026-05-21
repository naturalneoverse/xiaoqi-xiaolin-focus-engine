/**
 * 调用云函数 getReply（集合 taskReply，前端只读不写库）
 */

const { callFunction, isCloudReady } = require("./cloudCall");

const ERR_OFFLINE = "云服务不可用，请稍后重试";
const GET_REPLY_TIMEOUT_MS = 10000;

function composeFullText(fullPrefix, reply) {
  const a = String(fullPrefix || "").trim();
  const b = String(reply || "").trim();
  if (!a) return b;
  if (!b) return a;
  return `${a}\n${b}`;
}

function mapTaskReplyRecord(data) {
  if (!data || typeof data !== "object") return null;
  const fullPrefix = String(data.fullPrefix || "").trim();
  const reply = String(data.reply || "").trim();
  if (!reply) return null;
  return {
    code: String(data.code || ""),
    fullPrefix,
    reply,
    type1Name: String(data.type1Name || data.typeName || ""),
    type2Name: String(data.type2Name || ""),
    type3Name: String(data.type3Name || ""),
    fullText: composeFullText(fullPrefix, reply),
  };
}

/**
 * @param {string} code
 * @returns {Promise<{ success: boolean, errMsg: string, data: object|null }>}
 */
function fetchGetReply(code) {
  const c = String(code || "").trim();
  if (!/^[1-4]{3}$/.test(c)) {
    return Promise.resolve({
      success: false,
      errMsg: "组合码无效，请重新选择",
      data: null,
    });
  }
  return new Promise((resolve) => {
    if (!isCloudReady()) {
      resolve({ success: false, errMsg: ERR_OFFLINE, data: null });
      return;
    }
    callFunction(
      {
        name: "getReply",
        data: { code: c },
      },
      GET_REPLY_TIMEOUT_MS,
    )
      .then((res) => {
        const body = (res && res.result) || {};
        if (!body.success) {
          resolve({
            success: false,
            errMsg: body.errMsg || ERR_OFFLINE,
            data: null,
          });
          return;
        }
        const mapped = mapTaskReplyRecord(body.data);
        if (!mapped || !mapped.fullText) {
          resolve({
            success: false,
            errMsg: body.errMsg || "文案数据不完整，请稍后重试",
            data: null,
          });
          return;
        }
        resolve({ success: true, errMsg: "", data: mapped });
      })
      .catch((err) => {
        console.warn("[getReplyClient]", err);
        resolve({ success: false, errMsg: ERR_OFFLINE, data: null });
      });
  });
}

function buildInsightLine(record) {
  if (!record) return "";
  const p = record.type1Name || "这一程";
  const c = record.type2Name || "所系之人";
  const l = record.type3Name || "心底层次";
  return `小麒看见：${p}、${c}、${l}，三枚标签轻轻落在同一件事上。`;
}

module.exports = {
  fetchGetReply,
  mapTaskReplyRecord,
  composeFullText,
  buildInsightLine,
  ERR_OFFLINE,
};
