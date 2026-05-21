/**
 * 个人资料文案长度（仅代码内约束，不在 UI 展示字数规则）
 */

const NICKNAME_MAX_LEN = 10;
const SIGNATURE_MAX_LEN = 20;

function clampByCodePoints(str, maxLen) {
  const s = String(str || "");
  if (maxLen <= 0) return "";
  const chars = Array.from(s);
  if (chars.length <= maxLen) return s;
  return chars.slice(0, maxLen).join("");
}

function clampNickname(str) {
  return clampByCodePoints(str, NICKNAME_MAX_LEN);
}

function clampSignature(str) {
  return clampByCodePoints(str, SIGNATURE_MAX_LEN);
}

module.exports = {
  NICKNAME_MAX_LEN,
  SIGNATURE_MAX_LEN,
  clampNickname,
  clampSignature,
};
