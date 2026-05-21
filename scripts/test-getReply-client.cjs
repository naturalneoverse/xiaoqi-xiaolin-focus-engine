/**
 * 前端拼接逻辑冒烟（不连云）
 * node scripts/test-getReply-client.cjs
 */
const path = require("path");

function composeFullText(fullPrefix, reply) {
  const a = String(fullPrefix || "").trim();
  const b = String(reply || "").trim();
  if (!a) return b;
  if (!b) return a;
  return `${a}${b}`;
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
    type1Name: String(data.type1Name || ""),
    type2Name: String(data.type2Name || ""),
    type3Name: String(data.type3Name || ""),
    fullText: composeFullText(fullPrefix, reply),
  };
}

const sample = {
  code: "111",
  fullPrefix: "小麒看见，开头。",
  reply: "结尾。",
  type1Name: "重要且紧急",
  type2Name: "自己",
  type3Name: "生计",
};

const mapped = mapTaskReplyRecord(sample);
if (!mapped || mapped.fullText !== "小麒看见，开头。结尾。") {
  console.error("mapTaskReplyRecord failed", mapped);
  process.exit(1);
}

function buildQuizCode(p, c, l) {
  return `${p}${c}${l}`;
}
if (buildQuizCode(2, 1, 4) !== "214") {
  process.exit(1);
}

console.log("[test-getReply-client] OK");
