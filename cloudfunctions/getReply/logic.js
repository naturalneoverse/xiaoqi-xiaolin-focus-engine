const ERR_INVALID = "组合码无效，请重新选择";
const ERR_NOT_FOUND = "未找到对应文案，请稍后重试";
const ERR_QUERY = "查询失败，请稍后重试";
const ERR_INCOMPLETE = "文案数据不完整，请稍后重试";

function normalizeCode(raw) {
  return String(raw == null ? "" : raw).trim();
}

function isValidCode(code) {
  return /^[1-4]{3}$/.test(code);
}

function pickRecord(doc) {
  if (!doc) return null;
  const code = normalizeCode(doc.code);
  const fullPrefix = String(doc.fullPrefix == null ? "" : doc.fullPrefix).trim();
  const reply = String(doc.reply == null ? "" : doc.reply).trim();
  const type1Raw = doc.type1Name != null ? doc.type1Name : doc.typeName;
  const type1Name = String(type1Raw == null ? "" : type1Raw).trim();
  const type2Name = String(doc.type2Name == null ? "" : doc.type2Name).trim();
  const type3Name = String(doc.type3Name == null ? "" : doc.type3Name).trim();
  if (!code || !reply) return null;
  return {
    code,
    fullPrefix,
    reply,
    type1Name,
    type2Name,
    type3Name,
  };
}

function buildResponseFromDoc(doc) {
  const code = normalizeCode(doc && doc.code);
  if (!isValidCode(code)) {
    return { success: false, errMsg: ERR_INVALID, data: null, code };
  }
  const record = pickRecord(doc);
  if (!record) {
    return { success: false, errMsg: ERR_NOT_FOUND, data: null, code };
  }
  if (!record.fullPrefix) {
    return { success: false, errMsg: ERR_INCOMPLETE, data: null, code };
  }
  return { success: true, errMsg: "", data: record };
}

module.exports = {
  ERR_INVALID,
  ERR_NOT_FOUND,
  ERR_QUERY,
  ERR_INCOMPLETE,
  normalizeCode,
  isValidCode,
  pickRecord,
  buildResponseFromDoc,
};
