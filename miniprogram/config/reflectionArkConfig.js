/**
 * 哲思复盘 · 火山方舟云函数与缓存配置（对齐 docs/reflection-ark-integration.md）
 */

const CLOUD_FUNCTION_NAME = "reflectionArk";
const CACHE_COLLECTION = "reflection_ark_cache";

/** 内容安全校验（云函数 openapi） */
const MSG_SEC_TIMEOUT_MS = 12000;

/** 测试档：批量生成略大于云函数 60s，避免客户端先断 */
const GENERATE_REPLY_TIMEOUT_MS = 65000;

/** 审核不通过时温和提示（前端展示，无技术字段） */
const MSG_SEC_REJECT_HINT = "您填写的内容暂未通过审核，请调整用语后再提交。";
const MSG_SEC_ERROR_HINT = "内容审核服务暂不可用，请稍后再试。";
const MSG_SEC_STALE_SESSION_HINT = "请关闭小程序后重新打开，再提交本象限。";
const MSG_SEC_OPENID_HINT = "请先登录后再提交。";

const ERR_CLOUD_NOT_READY = "CLOUD_NOT_READY";

/** @param {string} [errCode] */
function hintForMsgSecErrCode(errCode) {
  const code = String(errCode || "");
  if (code === "MSG_SEC_REJECT") return MSG_SEC_REJECT_HINT;
  if (code === "MSG_SEC_STALE_SESSION" || code === "OPENID_INVALID") return MSG_SEC_STALE_SESSION_HINT;
  if (code === "OPENID_MISSING") return MSG_SEC_OPENID_HINT;
  if (code === ERR_CLOUD_NOT_READY) return "网络未就绪，请稍后再试";
  return MSG_SEC_ERROR_HINT;
}

module.exports = {
  CLOUD_FUNCTION_NAME,
  CACHE_COLLECTION,
  MSG_SEC_TIMEOUT_MS,
  GENERATE_REPLY_TIMEOUT_MS,
  MSG_SEC_REJECT_HINT,
  MSG_SEC_ERROR_HINT,
  MSG_SEC_STALE_SESSION_HINT,
  MSG_SEC_OPENID_HINT,
  hintForMsgSecErrCode,
  ERR_CLOUD_NOT_READY,
};
