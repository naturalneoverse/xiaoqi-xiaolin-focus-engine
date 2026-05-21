/**
 * 本地冒烟（不连云）：node cloudfunctions/getReply/smoke-local.js
 */
const {
  isValidCode,
  pickRecord,
  buildResponseFromDoc,
} = require("./logic");

function assert(cond, msg) {
  if (!cond) throw new Error(msg || "assert failed");
}

const sample = {
  code: "214",
  fullPrefix: "小麒看见，测试开头。",
  reply: "测试结尾陪伴。",
  type1Name: "重要不紧急",
  type2Name: "至亲挚友",
  type3Name: "职责",
};

assert(isValidCode("111") && !isValidCode("015"), "code regex");
assert(pickRecord(sample).code === "214", "pickRecord");
const ok = buildResponseFromDoc(sample);
assert(ok.success && ok.data.reply === "测试结尾陪伴。", "build ok");
const bad = buildResponseFromDoc({ code: "111", reply: "x" });
assert(!bad.success && bad.errMsg, "missing prefix");

console.log("[getReply smoke-local] OK");
