"use strict";

const PHONE_RE = /1[3-9]\d{9}/g;
const ID_CARD_RE = /\d{17}[\dXx]|\d{15}/g;
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

/** 常见住址线索（简化） */
const ADDRESS_HINT_RE = /(?:省|市|区|县|镇|乡|村|路|街|号|栋|单元|室)[^\n，。；]{0,40}/g;

/**
 * 云函数发送方舟前脱敏（不记录原文到日志）
 * @param {string} text
 * @returns {string}
 */
function desensitize(text) {
  let s = String(text || "");
  s = s.replace(PHONE_RE, "[已隐藏手机号]");
  s = s.replace(ID_CARD_RE, "[已隐藏证件号]");
  s = s.replace(EMAIL_RE, "[已隐藏邮箱]");
  s = s.replace(ADDRESS_HINT_RE, "[已隐藏地址信息]");
  return s.trim();
}

module.exports = { desensitize };
