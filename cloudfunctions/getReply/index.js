/**
 * getReply：按 code 查询云数据库 taskReply（只读）
 * 前端：wx.cloud.callFunction({ name: "getReply", data: { code: "123" } })
 */
const cloud = require("wx-server-sdk");
const {
  ERR_INVALID,
  ERR_NOT_FOUND,
  ERR_QUERY,
  normalizeCode,
  isValidCode,
  buildResponseFromDoc,
} = require("./logic");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const COLL = "taskReply";

function fail(errMsg, extra) {
  return Object.assign({ success: false, errMsg: errMsg || ERR_QUERY, data: null }, extra || {});
}

/**
 * @param {object} event 前端传入 { code: "111" }
 * @param {object} context 云函数上下文
 */
exports.main = async (event, context) => {
  const code = normalizeCode(event && event.code);
  if (!isValidCode(code)) {
    return fail(ERR_INVALID, { code });
  }

  try {
    const db = cloud.database();
    const res = await db.collection(COLL).where({ code }).limit(1).get();
    const out = buildResponseFromDoc(res.data && res.data[0]);
    if (context && context.requestId) {
      console.log("[getReply]", code, out.success ? "ok" : out.errMsg, context.requestId);
    }
    return out;
  } catch (e) {
    console.error("[getReply]", code, e && (e.message || e));
    return fail(ERR_QUERY, { code });
  }
};
