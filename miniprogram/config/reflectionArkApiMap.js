/**
 * 象限手写卡片 → API 调用目标（对齐 reflectionQuadrantCards + PRD）
 */

const { getQuadrantMeta } = require("./reflectionTheme");
const { getQuadrantCards, resolveSingleSelected } = require("./reflectionQuadrantCards");
const { createEmptyMultiExpandValues } = require("./reflectionMultiExpand");

/**
 * 单选题 → 与云函数一致的 userText（缓存 hash 对齐）
 * @param {string} question
 * @param {string} optionLabel
 */
function formatSingleChoiceUserText(question, optionLabel) {
  return `【题目】${String(question || "").trim()}\n【用户选择】${String(optionLabel || "").trim()}`;
}

/** 是否方舟/API 用的单选 userText */
function isSingleChoiceApiUserText(userText) {
  return String(userText || "").includes("【用户选择】");
}

/** 从 API userText 取出选项文案（报告展示用，不含题目） */
function parseSingleChoiceUserText(userText) {
  const s = String(userText || "");
  const idx = s.indexOf("【用户选择】");
  if (idx < 0) return "";
  return s.slice(idx + "【用户选择】".length).trim();
}

function hasText(value) {
  return String(value || "").trim().length > 0;
}

/**
 * Q4 是否仅 nothing 且无展开内容
 * @param {string[]} selected
 * @param {object} expand
 */
function isQ4OnlyNothing(selected, expand) {
  const sel = selected || [];
  const ex = Object.assign(createEmptyMultiExpandValues(), expand || {});
  const onlyNothing = sel.length === 1 && sel[0] === "nothing";
  return (
    onlyNothing &&
    !hasText(ex.experience) &&
    !hasText(ex.feeling) &&
    !hasText(ex.decision)
  );
}

/**
 * 从象限表单状态收集需调 API 的手写项（供安全审核、串行 generate）
 * @param {number} quadrantId
 * @param {{ textValues?: object, multiValues?: object, multiExpandValues?: object }} form
 * @returns {{ cardField: string, userText: string, agentType: string }[]}
 */
function collectHandwritingApiTargets(quadrantId, form) {
  const id = Number(quadrantId);
  const meta = getQuadrantMeta(id);
  const agentType = meta && meta.agent ? meta.agent : "xiaolin";
  const cards = getQuadrantCards(id);
  const textValues = (form && form.textValues) || {};
  const singleValues = (form && form.singleValues) || {};
  const multiValues = (form && form.multiValues) || {};
  const multiExpandValues = (form && form.multiExpandValues) || {};
  const targets = [];

  (cards || []).forEach((card) => {
    if (!card || !card.field) return;
    if (card.type === "text") {
      const userText = String(textValues[card.field] || "").trim();
        if (hasText(userText)) {
        const target = { cardField: card.field, userText, agentType };
        if ((id === 1 || id === 2 || id === 3 || id === 4) && card.question) {
          target.question = String(card.question).trim();
        }
        targets.push(target);
      }
      return;
    }
    if (card.type === "single" && (id === 1 || id === 3)) {
      const selectedId = String(singleValues[card.field] || "").trim();
      if (!selectedId) return;
      const opt = (card.options || []).find((o) => o && o.id === selectedId);
      const label = opt && opt.label ? String(opt.label).trim() : selectedId;
      const userText = formatSingleChoiceUserText(card.question, label);
      targets.push({
        cardField: card.field,
        userText,
        agentType,
        question: String(card.question || "").trim(),
      });
      return;
    }
    if (card.type === "multi" && card.hasExpand && id === 4) {
      const selected = multiValues[card.field] || [];
      const expand = multiExpandValues[card.field] || {};
      if (isQ4OnlyNothing(selected, expand)) return;
      if (selected.indexOf("experience") >= 0 && hasText(expand.experience)) {
        targets.push({
          cardField: "c2_experience",
          userText: String(expand.experience).trim(),
          agentType,
          question: "带给自己一个经验",
        });
      }
      if (selected.indexOf("feeling") >= 0 && hasText(expand.feeling)) {
        targets.push({
          cardField: "c2_feeling",
          userText: String(expand.feeling).trim(),
          agentType,
          question: "带给自己一个感受",
        });
      }
      if (selected.indexOf("decision") >= 0 && hasText(expand.decision)) {
        targets.push({
          cardField: "c2_decision",
          userText: String(expand.decision).trim(),
          agentType,
          question: "带给自己一个决定",
        });
      }
    }
  });

  return targets;
}

/**
 * 合并待检文本（象限提交前一次 msgSecCheck）
 * @param {{ userText: string }[]} targets
 * @returns {string}
 */
function joinTargetsForSecCheck(targets) {
  return (targets || [])
    .map((t) => String(t.userText || "").trim())
    .filter(Boolean)
    .join("\n");
}

/** 提交进度文案（骨架屏） */
const CARD_FIELD_PROGRESS_LABEL = {
  c0: "手写内容",
  c1: "手写内容",
  c2: "手写内容",
  c2_experience: "经验感悟",
  c2_feeling: "感受记录",
  c2_decision: "决定事项",
};

function getCardFieldProgressLabel(cardField) {
  return CARD_FIELD_PROGRESS_LABEL[String(cardField || "")] || "手写内容";
}

/** 静态索引：各象限可能触发 API 的 cardField（文档/调试用） */
const API_CARD_FIELDS_BY_QUADRANT = {
  1: ["c0", "c1", "c2"],
  2: ["c0", "c1", "c2"],
  3: ["c0", "c1", "c2"],
  4: ["c0", "c1", "c2_experience", "c2_feeling", "c2_decision"],
};

module.exports = {
  API_CARD_FIELDS_BY_QUADRANT,
  CARD_FIELD_PROGRESS_LABEL,
  getCardFieldProgressLabel,
  formatSingleChoiceUserText,
  isSingleChoiceApiUserText,
  parseSingleChoiceUserText,
  collectHandwritingApiTargets,
  joinTargetsForSecCheck,
  isQ4OnlyNothing,
  hasText,
};
