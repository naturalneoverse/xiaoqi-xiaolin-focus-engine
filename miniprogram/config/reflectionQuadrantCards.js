/**
 * 各象限卡片配置
 */

const { createEmptyMultiExpandValues } = require("./reflectionMultiExpand");
const { Q1_BUBBLE2 } = require("./reflectionConclusions");

const TEXT_MAX = 300;

const Q1_SINGLE_OPTIONS = [
  { id: "full", label: "全心投入，忘了时间" },
  { id: "routine", label: "按部就班，完成任务" },
  { id: "distracted", label: "心不在焉，做着但想着别的" },
  { id: "forced", label: "硬撑着做完，很勉强" },
];

/** 象限一：观实归真 — 文本 + 单选 + 文本 */
const QUADRANT_1_CARDS = [
  {
    field: "c0",
    type: "text",
    question: "这件事，和你想的一样吗？",
    placeholder: "如实写下真实经过，放下主观评判，只说说内心预期与实际发生的不同",
    maxLength: TEXT_MAX,
  },
  {
    field: "c1",
    type: "single",
    question: "做这件事的时候，你在哪里？",
    options: Q1_SINGLE_OPTIONS,
  },
  {
    field: "c2",
    type: "text",
    question: "这件事，去掉你的评价，还剩下什么？",
    placeholder: Q1_BUBBLE2,
    maxLength: TEXT_MAX,
  },
];

/** 象限二：观心明己 — 3 张自由文本 */
const QUADRANT_2_CARDS = [
  {
    field: "c0",
    type: "text",
    question: "这件事有什么让你觉得「卡住了」？",
    placeholder: "例如话到嘴边说不出口，感觉哪里不对又说不上来，不敢面对，突发意外……写下来",
    maxLength: TEXT_MAX,
  },
  {
    field: "c1",
    type: "text",
    question: "这件事，碰到了你心里的哪根弦？",
    placeholder: "它可能叫：面子、公平，也可能叫：在意、期待、想做得更好。写下来就好。",
    maxLength: TEXT_MAX,
  },
  {
    field: "c2",
    type: "text",
    question: "在这件事里，你觉得什么是你真正在意的？",
    placeholder: "你真正不想妥协的那个东西，叫什么？",
    maxLength: TEXT_MAX,
  },
];

const Q3_SINGLE_OPTIONS = [
  { id: "mostly", label: "有，很大程度是为了被认可" },
  { id: "somewhat", label: "有一点，但不全是" },
  { id: "none", label: "没有，我就是想做这件事本身" },
];

/** 象限三：自我主宰 — 文本 + 三选一 + 文本 */
const QUADRANT_3_CARDS = [
  {
    field: "c0",
    type: "text",
    question: "这件事里，哪些是你自己的课题，哪些是别人的？",
    placeholder: "分开写：我的 / 别人的",
    maxLength: TEXT_MAX,
  },
  {
    field: "c1",
    type: "single",
    question: "这件事里，你有没有为了被认可而做？",
    options: Q3_SINGLE_OPTIONS,
  },
  {
    field: "c2",
    type: "text",
    question: "放下不属于你的，你最想做什么，怎么做？",
    placeholder: "松开一直端着的肩膀。写下你放下的，再写下你拿起的第一步——步子小没关系，迈出去就行。",
    maxLength: TEXT_MAX,
  },
];

const Q4_MULTI_OPTIONS = [
  { id: "experience", label: "带给自己一个经验（下次遇到类似的事，知道怎么做更好）" },
  { id: "feeling", label: "带给自己一个感受（做这件事的时候，某个时刻让你难忘）" },
  { id: "decision", label: "带给自己一个决定（通过这件事，你决定了接下来要做什么或不再做什么）" },
  { id: "nothing", label: "什么也不留，让它过去（放下一件事，也是一种选择）" },
];

/** 象限四：双文本 + 多选（选项下方 inline 展开录入） */
const QUADRANT_4_CARDS = [
  {
    field: "c0",
    type: "text",
    question: "如果时间有限，今天最值得你亲自做的一件事是什么？",
    placeholder: "不是必须，而是值得",
    maxLength: TEXT_MAX,
  },
  {
    field: "c1",
    type: "text",
    question: "明天，你打算怎么开始？",
    placeholder: "哪怕只是很小的一步",
    maxLength: TEXT_MAX,
  },
  {
    field: "c2",
    type: "multi",
    question: "你想从这件事里，带给自己什么？",
    options: Q4_MULTI_OPTIONS,
    exclusiveId: "nothing",
    hasExpand: true,
  },
];

const QUADRANT_CARDS_MAP = {
  1: QUADRANT_1_CARDS,
  2: QUADRANT_2_CARDS,
  3: QUADRANT_3_CARDS,
  4: QUADRANT_4_CARDS,
};

function cloneCards(cards) {
  return (cards || []).map((card) => {
    if (card.type === "single" || card.type === "multi") {
      return {
        ...card,
        options: (card.options || []).map((o) => ({ ...o })),
      };
    }
    return { ...card };
  });
}

function getQuadrantCards(quadrantId) {
  const id = Number(quadrantId);
  return cloneCards(QUADRANT_CARDS_MAP[id] || []);
}

function initCardValues(cards) {
  const textValues = {};
  const singleValues = {};
  const multiValues = {};
  const multiExpandValues = {};
  (cards || []).forEach((card) => {
    if (!card || !card.field) return;
    if (card.type === "single") {
      singleValues[card.field] = "";
    } else if (card.type === "text") {
      textValues[card.field] = "";
    } else if (card.type === "multi") {
      multiValues[card.field] = [];
      if (card.hasExpand) {
        multiExpandValues[card.field] = createEmptyMultiExpandValues();
      }
    }
  });
  return { textValues, singleValues, multiValues, multiExpandValues };
}

function resolveSingleSelected(card, resp) {
  if (!resp || resp.type !== "single") return "";
  let selected = resp.selected || "";
  if (!selected && resp.label && card && card.options) {
    const opt = card.options.find((o) => o && o.label === resp.label);
    if (opt) selected = opt.id;
  }
  return selected;
}

/**
 * 从已存象限记录恢复表单（按卡片顺序；单选可凭 label 反查 id）
 */
function applySavedResponses(cards, savedEntry) {
  const values = initCardValues(cards);
  if (!savedEntry || !Array.isArray(savedEntry.cardResponses)) {
    return values;
  }
  const responses = savedEntry.cardResponses;
  (cards || []).forEach((card, index) => {
    const resp = responses[index];
    if (!resp || !card || !card.field) return;
    if (card.type === "text" && resp.type === "text") {
      values.textValues[card.field] = typeof resp.text === "string" ? resp.text : "";
    }
    if (card.type === "single") {
      values.singleValues[card.field] = resolveSingleSelected(card, resp);
    }
    if (card.type === "multi" && resp.type === "multi") {
      values.multiValues[card.field] = Array.isArray(resp.selected) ? resp.selected.slice() : [];
      if (card.hasExpand) {
        values.multiExpandValues[card.field] = {
          experience: typeof resp.experience === "string" ? resp.experience : "",
          feeling: typeof resp.feeling === "string" ? resp.feeling : "",
          decision: typeof resp.decision === "string" ? resp.decision : "",
        };
      }
    }
  });
  return values;
}

function buildCardResponses(cards, textValues, singleValues, multiValues, multiExpandValues) {
  return (cards || []).map((card) => {
    if (card.type === "text") {
      return {
        type: "text",
        text: ((textValues && textValues[card.field]) || "").trim(),
      };
    }
    if (card.type === "single") {
      const selected = (singleValues && singleValues[card.field]) || "";
      const opt = (card.options || []).find((o) => o && o.id === selected);
      return {
        type: "single",
        selected,
        label: opt ? opt.label : "",
      };
    }
    if (card.type === "multi") {
      const selected = ((multiValues && multiValues[card.field]) || []).slice();
      const labels = selected
        .map((id) => {
          const opt = (card.options || []).find((o) => o && o.id === id);
          return opt ? opt.label : "";
        })
        .filter(Boolean);
      const resp = { type: "multi", selected, labels };
      if (card.hasExpand) {
        const expand = Object.assign(
          createEmptyMultiExpandValues(),
          (multiExpandValues && multiExpandValues[card.field]) || {},
        );
        if (selected.indexOf("experience") >= 0) {
          resp.experience = (expand.experience || "").trim();
        }
        if (selected.indexOf("feeling") >= 0) {
          resp.feeling = (expand.feeling || "").trim();
        }
        if (selected.indexOf("decision") >= 0) {
          resp.decision = (expand.decision || "").trim();
        }
      }
      return resp;
    }
    return { type: "unknown", field: card.field };
  });
}

/** @deprecated use initCardValues */
function initTextCardValues(cards) {
  return initCardValues(cards).textValues;
}

module.exports = {
  TEXT_MAX,
  QUADRANT_1_CARDS,
  QUADRANT_2_CARDS,
  QUADRANT_3_CARDS,
  QUADRANT_4_CARDS,
  Q4_MULTI_OPTIONS,
  getQuadrantCards,
  initCardValues,
  applySavedResponses,
  resolveSingleSelected,
  buildCardResponses,
  initTextCardValues,
};
