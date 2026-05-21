/**
 * 任务创建答题：64 组组合码文案（云数据库 task_quiz_copy）
 * 固定开头、编码规则、圈层「不二」定义 — 仅在此模块维护，禁止在前端写入大段映射。
 */

const cloud = require("wx-server-sdk");

const COLL = "task_quiz_copy";

/** 【严禁修改】固定开头，全文展示时置于云端结尾文案之前 */
const TASK_QUIZ_FIXED_INTRO =
  "小麒看见，你愿意为这件事留一份心意，本身就值得被轻轻看见。";

const PRIORITY_TAIL = [
  "",
  "紧要的事在敲门，",
  "重要的事不必抢跑，",
  "外面的催促很响，",
  "也许这件事可以松一松，",
];

const CIRCLE_TAIL = [
  "",
  "你先照顾好自己的那一盏灯，",
  "亲近之人的温度也在其中，",
  "外缘的事务轻轻靠过来，",
  "自他与他人，你都愿意一并看见，",
];

const LAYER_TAIL = [
  "",
  "生计托住脚下，",
  "职责让你站直，",
  "真我在小声说话，",
  "几层心意叠在一处，",
];

const INSIGHT_TEMPLATES = [
  "这一刻，{p}里为{c}，也连着{l}——小麒替你记下了。",
  "小麒看见：{p}、{c}、{l}，三枚标签轻轻落在同一件事上。",
  "{p}与{c}之间，还有一层{l}；不必急着说明白，先陪着就好。",
];

function buildFallbackClosing(code) {
  const p = Number(code[0]) || 1;
  const c = Number(code[1]) || 1;
  const l = Number(code[2]) || 1;
  const mid = `${PRIORITY_TAIL[p]}${CIRCLE_TAIL[c]}${LAYER_TAIL[l]}`;
  return `${mid}小麒在这儿，陪你把这一笔安放好。`;
}

function buildFallbackInsight(labels) {
  const p = (labels && labels.priority) || "这一程";
  const c = (labels && labels.circle) || "所系之人";
  const l = (labels && labels.layer) || "心底层次";
  const tpl = INSIGHT_TEMPLATES[(p.length + c.length + l.length) % INSIGHT_TEMPLATES.length];
  return tpl.replace("{p}", p).replace("{c}", c).replace("{l}", l);
}

function composeFullText(fixedIntro, closing) {
  const a = String(fixedIntro || "").trim();
  const b = String(closing || "").trim();
  if (!a) return b;
  if (!b) return a;
  return `${a}${b}`;
}

async function getDocByCode(db, code) {
  try {
    const res = await db.collection(COLL).where({ code }).limit(1).get();
    return (res.data && res.data[0]) || null;
  } catch (e) {
    console.warn("[taskQuiz] getDocByCode", code, e && e.message);
    return null;
  }
}

async function getTaskQuizCopy(event) {
  const code = String((event && event.code) || "").trim();
  if (!/^[1-4]{3}$/.test(code)) {
    return { success: false, errMsg: "invalid code" };
  }

  const db = cloud.database();
  const doc = await getDocByCode(db, code);
  const fixedIntro = TASK_QUIZ_FIXED_INTRO;
  const closing =
    (doc && typeof doc.closing === "string" && doc.closing.trim()) ||
    buildFallbackClosing(code);
  const fullText = composeFullText(fixedIntro, closing);

  return {
    success: true,
    code,
    fixedIntro,
    closing,
    fullText,
    fromCloud: !!(doc && doc.closing),
  };
}

async function getTaskQuizInsight(event) {
  const code = String((event && event.code) || "").trim();
  const labels = (event && event.labels) || {};
  if (!/^[1-4]{3}$/.test(code)) {
    return { success: false, errMsg: "invalid code" };
  }

  const db = cloud.database();
  const doc = await getDocByCode(db, code);
  const insight =
    (doc && typeof doc.insight === "string" && doc.insight.trim()) ||
    buildFallbackInsight(labels);

  return {
    success: true,
    code,
    insight,
    fromCloud: !!(doc && doc.insight),
  };
}

const PRIORITY_TITLES = ["", "重要且紧急", "重要不紧急", "紧急不重要", "不重要不紧急"];
const CIRCLE_TITLES = ["", "自己", "至亲挚友", "外缘", "不二"];
const LAYER_TITLES = ["", "生计", "职责", "真我", "合一"];

/** 供运维脚本写入 64 条记录 */
function buildSeedRecords() {
  const list = [];
  for (let p = 1; p <= 4; p++) {
    for (let c = 1; c <= 4; c++) {
      for (let l = 1; l <= 4; l++) {
        const code = `${p}${c}${l}`;
        const labels = {
          priority: PRIORITY_TITLES[p],
          circle: CIRCLE_TITLES[c],
          layer: LAYER_TITLES[l],
        };
        list.push({
          code,
          closing: buildFallbackClosing(code),
          insight: buildFallbackInsight(labels),
          updatedAt: Date.now(),
        });
      }
    }
  }
  return list;
}

module.exports = {
  TASK_QUIZ_FIXED_INTRO,
  COLL,
  getTaskQuizCopy,
  getTaskQuizInsight,
  buildSeedRecords,
  buildFallbackClosing,
};
