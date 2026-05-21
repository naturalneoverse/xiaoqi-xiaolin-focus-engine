"use strict";

const cloud = require("wx-server-sdk");
const { logEvent } = require("./logger");

/** 微信 msgSecCheck v2：scene 4 = 社交日志（哲思复盘手写） */
const SEC_CHECK_SCENE = 4;

/**
 * 合并待检文本（支持单段 content 或多段 contents）
 * @param {object} event
 * @returns {string}
 */
function mergeSecCheckText(event) {
  if (event && Array.isArray(event.contents) && event.contents.length) {
    return event.contents
      .map((c) => String(c || "").trim())
      .filter(Boolean)
      .join("\n");
  }
  return String((event && event.content) || "").trim();
}

/**
 * @param {number|string} errcode
 * @returns {string}
 */
function mapWxSecErrCode(errcode) {
  const code = Number(errcode);
  if (code === 61010) return "MSG_SEC_STALE_SESSION";
  if (code === 40003 || code === 43104) return "OPENID_INVALID";
  return "MSG_SEC_ERROR";
}

/**
 * 内容安全（需 config.json 开通 security.msgSecCheck；v2 必填 openid）
 * @param {object|string} eventOrContent 事件对象或纯文本
 * @returns {Promise<{ ok: boolean, errCode?: string }>}
 */
async function handleMsgSecCheck(eventOrContent) {
  const event =
    eventOrContent && typeof eventOrContent === "object" ? eventOrContent : { content: eventOrContent };
  const text = mergeSecCheckText(event);
  if (!text) {
    return { ok: true };
  }

  const wxContext = cloud.getWXContext();
  const openid = wxContext && wxContext.OPENID ? String(wxContext.OPENID).trim() : "";
  if (!openid) {
    logEvent({
      level: "error",
      action: "msgSecCheck",
      errCode: "OPENID_MISSING",
    });
    return { ok: false, errCode: "OPENID_MISSING" };
  }

  try {
    const res = await cloud.openapi.security.msgSecCheck({
      openid,
      content: text,
      version: 2,
      scene: SEC_CHECK_SCENE,
    });

    const apiErr = res && res.errcode;
    if (apiErr != null && Number(apiErr) !== 0) {
      const errCode = mapWxSecErrCode(apiErr);
      logEvent({
        level: "error",
        action: "msgSecCheck",
        errCode,
        cardField: String(apiErr),
      });
      return { ok: false, errCode };
    }

    const suggest = res && res.result && res.result.suggest;
    const label = res && res.result && res.result.label;
    if (suggest === "pass" || suggest === "review") {
      logEvent({ action: "msgSecCheck", errCode: "PASS" });
      return { ok: true };
    }
    logEvent({
      level: "error",
      action: "msgSecCheck",
      errCode: "MSG_SEC_REJECT",
      cardField: String(label != null ? label : ""),
    });
    return { ok: false, errCode: "MSG_SEC_REJECT" };
  } catch (e) {
    const wxCode = e && (e.errCode != null ? e.errCode : e.errcode);
    const errCode = wxCode != null ? mapWxSecErrCode(wxCode) : "MSG_SEC_ERROR";
    logEvent({
      level: "error",
      action: "msgSecCheck",
      errCode: String(errCode).slice(0, 32),
      cardField: wxCode != null ? String(wxCode).slice(0, 16) : "",
    });
    return { ok: false, errCode };
  }
}

module.exports = { handleMsgSecCheck };
