/**
 * getTimeWeaveCopy：按 copyKey + lineIndex 查询 timeWeaveCopy
 * 前端：wx.cloud.callFunction({ name: "getTimeWeaveCopy", data: { copyKey, lineIndex } })
 */
const cloud = require("wx-server-sdk");
const {
  ERR_INVALID,
  ERR_NOT_FOUND,
  ERR_QUERY,
  VALID_KEYS,
  normalizeCopyKey,
  normalizeLineIndex,
  buildResponseFromDoc,
} = require("./logic");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const COLL = "timeWeaveCopy";

function fail(errMsg, extra) {
  return Object.assign({ success: false, errMsg: errMsg || ERR_QUERY, text: "", data: null }, extra || {});
}

exports.main = async (event, context) => {
  const copyKey = normalizeCopyKey(event && event.copyKey);
  const lineIndex = normalizeLineIndex(event && event.lineIndex);
  if (!VALID_KEYS.has(copyKey) || !lineIndex) {
    return fail(ERR_INVALID, { copyKey, lineIndex });
  }

  try {
    const db = cloud.database();
    const res = await db
      .collection(COLL)
      .where({ copyKey, lineIndex })
      .limit(1)
      .get();
    const out = buildResponseFromDoc(res.data && res.data[0]);
    if (context && context.requestId) {
      console.log("[getTimeWeaveCopy]", copyKey, lineIndex, out.success ? "ok" : out.errMsg);
    }
    if (out.success) {
      return { success: true, errMsg: "", text: out.text, data: out.data };
    }
    return fail(out.errMsg, { copyKey, lineIndex });
  } catch (e) {
    console.error("[getTimeWeaveCopy]", copyKey, lineIndex, e && (e.message || e));
    return fail(ERR_QUERY, { copyKey, lineIndex });
  }
};
