const ERR_INVALID = "文案类型无效";

const ERR_NOT_FOUND = "未找到对应文案，请稍后重试";

const ERR_QUERY = "查询失败，请稍后重试";



const VALID_KEYS = new Set([

  "oneSelf",

  "depthSlow",

  "depthFast",

  "connection",

  "roleDuty",

  "calmBusy",

  "calmEasy",

]);



function normalizeCopyKey(raw) {

  return String(raw == null ? "" : raw).trim();

}



function normalizeLineIndex(raw) {

  const n = Number(raw);

  if (!Number.isFinite(n) || n < 1 || n > 6) return 0;

  return Math.floor(n);

}



function pickRecord(doc) {

  if (!doc) return null;

  const copyKey = normalizeCopyKey(doc.copyKey);

  const lineIndex = normalizeLineIndex(doc.lineIndex);

  const text = String(doc.text == null ? "" : doc.text).trim();

  if (!copyKey || !lineIndex || !text) return null;

  return { copyKey, lineIndex, text };

}



function buildResponseFromDoc(doc) {

  const copyKey = normalizeCopyKey(doc && doc.copyKey);

  const lineIndex = normalizeLineIndex(doc && doc.lineIndex);

  if (!VALID_KEYS.has(copyKey) || !lineIndex) {

    return { success: false, errMsg: ERR_INVALID, data: null, copyKey, lineIndex };

  }

  const record = pickRecord(doc);

  if (!record) {

    return { success: false, errMsg: ERR_NOT_FOUND, data: null, copyKey, lineIndex };

  }

  return { success: true, errMsg: "", data: record, text: record.text };

}



module.exports = {

  ERR_INVALID,

  ERR_NOT_FOUND,

  ERR_QUERY,

  VALID_KEYS,

  normalizeCopyKey,

  normalizeLineIndex,

  pickRecord,

  buildResponseFromDoc,

};

