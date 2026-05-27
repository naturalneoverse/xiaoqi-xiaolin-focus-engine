/**
 * 复盘报告叙事 humorous_v1_with_original（与 reflectionReportNarrativeSpec 对齐）
 * 不展示题目；先「您说：」再回响；禁复述原文、禁「应该」「必须」。
 */

const { getQuadrantCards, resolveSingleSelected } = require("../config/reflectionQuadrantCards");
const {
  SHORT_TH,
  LONG_TH,
  REPORT_COMBO_INTRO,
  REPORT_COMBO_OUTRO,
  QUADRANT_1,
  QUADRANT_2,
  QUADRANT_3,
  QUADRANT_4,
  GENERAL_SUMMARY,
  FALLBACK_NO_ANSWER,
} = require("../config/reflectionReportNarrativeSpec");

function len(s) {
  return typeof s === "string" ? s.trim().length : 0;
}

function hasAnyText(t) {
  return len(t) > 0;
}

function normalizeQuoteText(s) {
  return String(s || "").trim().replace(/\s+/g, " ");
}

const USER_PREFIX = "您说：";
const USER_CHOICE_PREFIX = "您选择：";
const QUOTE_OPEN = "「";
const QUOTE_CLOSE = "」";

function formatUserSays(text) {
  const t = normalizeQuoteText(text);
  if (!t) return "";
  return `${USER_PREFIX}${QUOTE_OPEN}${t}${QUOTE_CLOSE}`;
}

/** 单选题报告行：仅展示选项文案 */
function formatUserChoice(label) {
  const t = normalizeQuoteText(label);
  if (!t) return "";
  return `${USER_CHOICE_PREFIX}${QUOTE_OPEN}${t}${QUOTE_CLOSE}`;
}

/** 只取第一条匹配（顺序由 spec 定义） */
function emotionHintFirstMatch(scanText) {
  const t = String(scanText || "");
  if (!t) return "";
  const list = QUADRANT_2.emotion_keywords || [];
  for (let i = 0; i < list.length; i++) {
    const pair = list[i];
    if (!pair || pair.length < 2) continue;
    try {
      if (new RegExp(pair[0]).test(t)) return pair[1];
    } catch (e) {
      /* ignore bad pattern */
    }
  }
  return "";
}

function appendEmotion(body, scanText) {
  const hint = emotionHintFirstMatch(scanText);
  if (!hint) return body || "";
  const b = String(body || "").trim();
  if (!b) return hint;
  return `${b}\n${hint}`;
}

function lengthFlavorGlobal(trimmed) {
  const t = trimmed || "";
  const L = t.length;
  if (L === 0) return "";
  if (L <= SHORT_TH) return QUADRANT_2.length_short;
  if (L >= LONG_TH) return QUADRANT_2.length_long;
  return "";
}

function lengthFlavorQ4Experience(trimmed) {
  const t = trimmed || "";
  if (t.length >= QUADRANT_4.experience_long_th) return QUADRANT_4.experience_long_style;
  return "";
}

function lengthFlavorQ4FeelingDecision(trimmed) {
  const t = trimmed || "";
  if (t.length >= QUADRANT_4.feeling_decision_long_th) return QUADRANT_4.feeling_decision_long_style;
  return "";
}

function respAt(cards, cardResponses, index) {
  return (cardResponses && cardResponses[index]) || null;
}

function optionLabel(card, id) {
  if (!card || !card.options || !id) return "";
  const o = card.options.find((x) => x && x.id === id);
  return o && o.label ? String(o.label) : "";
}

function joinChunks(chunks) {
  return chunks.filter(Boolean);
}

/** 象限一 */
function echoQ1(cards, cardResponses) {
  const chunks = [];
  const r0 = respAt(cards, cardResponses, 0);
  const r1 = respAt(cards, cardResponses, 1);
  const r2 = respAt(cards, cardResponses, 2);
  const card1 = cards[1];

  const t0 = r0 && r0.type === "text" ? r0.text : "";
  if (hasAnyText(t0)) {
    const nt = normalizeQuoteText(t0);
    const user = formatUserSays(t0);
    const lf = lengthFlavorGlobal(nt);
    const parts = [];
    if (lf) parts.push(lf);
    const body = appendEmotion(parts.join("\n"), nt);
    chunks.push(body ? `${user}\n\n${body}` : user);
  }

  if (card1 && card1.type === "single" && r1 && r1.type === "single") {
    const id = resolveSingleSelected(card1, r1);
    if (id) {
      const mapDisp = QUADRANT_1.single_choice_mapping[id];
      const label = mapDisp || optionLabel(card1, id) || id;
      const user = formatUserSays(label);
      const out = QUADRANT_1.output_by_choice[id];
      const echo = QUADRANT_1.echo_by_choice[id];
      if (out && echo) {
        const t0s = normalizeQuoteText(t0);
        const t2s = normalizeQuoteText(r2 && r2.type === "text" ? r2.text : "");
        const scan = `${t0s} ${t2s}`.trim();
        let body = [out, echo, QUADRANT_1.statistics_humorous].join("\n");
        body = appendEmotion(body, scan);
        chunks.push(`${user}\n\n${body}`);
      }
    }
  }

  const t2 = r2 && r2.type === "text" ? r2.text : "";
  if (hasAnyText(t2)) {
    const nt = normalizeQuoteText(t2);
    const user = formatUserSays(t2);
    const lf = lengthFlavorGlobal(nt);
    const parts = [];
    if (lf) parts.push(lf);
    const body = appendEmotion(parts.join("\n"), nt);
    chunks.push(body ? `${user}\n\n${body}` : user);
  }

  return joinChunks(chunks);
}

/** 象限二 */
function echoQ2(cards, cardResponses) {
  const chunks = [];
  const keys = ["card0", "card1", "card2"];
  keys.forEach((key, idx) => {
    const r = respAt(cards, cardResponses, idx);
    const raw = r && r.type === "text" ? r.text : "";
    if (!hasAnyText(raw)) return;
    const nt = normalizeQuoteText(raw);
    const user = formatUserSays(raw);
    const lf = lengthFlavorGlobal(nt);
    const core = QUADRANT_2.output_by_card[key];
    if (!core) return;
    const parts = [];
    if (lf) parts.push(lf);
    parts.push(core);
    const body = appendEmotion(parts.join("\n"), nt);
    chunks.push(`${user}\n\n${body}`);
  });
  return joinChunks(chunks);
}

/** 象限三 */
function echoQ3(cards, cardResponses) {
  const chunks = [];
  const r0 = respAt(cards, cardResponses, 0);
  const r1 = respAt(cards, cardResponses, 1);
  const r2 = respAt(cards, cardResponses, 2);
  const card1 = cards[1];

  const t0 = r0 && r0.type === "text" ? r0.text : "";
  if (hasAnyText(t0)) {
    const nt = normalizeQuoteText(t0);
    const user = formatUserSays(t0);
    const lf = lengthFlavorGlobal(nt);
    const parts = [];
    if (lf) parts.push(lf);
    const body = appendEmotion(parts.join("\n"), nt);
    chunks.push(body ? `${user}\n\n${body}` : user);
  }

  if (card1 && card1.type === "single" && r1 && r1.type === "single") {
    const id = resolveSingleSelected(card1, r1);
    if (id) {
      const mapDisp = QUADRANT_3.single_choice_mapping[id];
      const label = mapDisp || optionLabel(card1, id) || id;
      const user = formatUserSays(label);
      const out = QUADRANT_3.output_by_choice[id];
      const echo = QUADRANT_3.echo_by_choice[id];
      if (out && echo) {
        const t0s = normalizeQuoteText(t0);
        const t2s = normalizeQuoteText(r2 && r2.type === "text" ? r2.text : "");
        const scan = `${t0s} ${t2s}`.trim();
        let body = [out, echo, QUADRANT_3.statistics_humorous].join("\n");
        body = appendEmotion(body, scan);
        chunks.push(`${user}\n\n${body}`);
      }
    }
  }

  const t2 = r2 && r2.type === "text" ? r2.text : "";
  if (hasAnyText(t2)) {
    const nt = normalizeQuoteText(t2);
    const user = formatUserSays(t2);
    const lf = lengthFlavorGlobal(nt);
    const parts = [];
    if (lf) parts.push(lf);
    const body = appendEmotion(parts.join("\n"), nt);
    chunks.push(body ? `${user}\n\n${body}` : user);
  }

  return joinChunks(chunks);
}

function q4SelectionKey(selected, hasEx, hasFe, hasDe) {
  const types = (selected || []).filter((x) => x && x !== "nothing");
  if (!types.length) {
    if ((selected || []).indexOf("nothing") >= 0) return "only_nothing";
    return "";
  }
  if (types.length === 1) {
    if (types[0] === "experience") return "has_experience";
    if (types[0] === "feeling") return "has_feeling";
    if (types[0] === "decision") return "has_decision";
  }
  return "mixed";
}

function q4MultiLead(selected) {
  const types = (selected || []).filter((id) => id && id !== "nothing");
  if (!types.length) {
    if ((selected || []).indexOf("nothing") >= 0) return "您选择：什么也不留";
    return "";
  }
  if (types.length === 1) {
    if (types[0] === "experience") return "您想带给自己一个经验";
    if (types[0] === "feeling") return "您想带给自己一个感受";
    if (types[0] === "decision") return "您想带给自己一个决定";
  }
  const brief = types
    .map((id) => {
      if (id === "experience") return "经验";
      if (id === "feeling") return "感受";
      if (id === "decision") return "决定";
      return "";
    })
    .filter(Boolean);
  return `您想带给自己：${brief.join("、")}`;
}

/** 象限四 */
function echoQ4(cards, cardResponses) {
  const chunks = [];
  const r0 = respAt(cards, cardResponses, 0);
  const r1 = respAt(cards, cardResponses, 1);
  const r2 = respAt(cards, cardResponses, 2);

  const t0 = r0 && r0.type === "text" ? r0.text : "";
  if (hasAnyText(t0)) {
    const nt = normalizeQuoteText(t0);
    const user = formatUserSays(t0);
    const lf = lengthFlavorGlobal(nt);
    const parts = [];
    if (lf) parts.push(lf);
    const body = appendEmotion(parts.join("\n"), nt);
    chunks.push(body ? `${user}\n\n${body}` : user);
  }

  const t1 = r1 && r1.type === "text" ? r1.text : "";
  if (hasAnyText(t1)) {
    const nt = normalizeQuoteText(t1);
    const user = formatUserSays(t1);
    const lf = lengthFlavorGlobal(nt);
    const parts = [];
    if (lf) parts.push(lf);
    const body = appendEmotion(parts.join("\n"), nt);
    chunks.push(body ? `${user}\n\n${body}` : user);
  }

  if (!r2 || r2.type !== "multi") {
    return joinChunks(chunks);
  }

  const selected = Array.isArray(r2.selected) ? r2.selected.slice() : [];
  const ex = typeof r2.experience === "string" ? r2.experience.trim() : "";
  const fe = typeof r2.feeling === "string" ? r2.feeling.trim() : "";
  const de = typeof r2.decision === "string" ? r2.decision.trim() : "";
  const hasEx = hasAnyText(ex);
  const hasFe = len(fe) > 0;
  const hasDe = len(de) > 0;

  if (selected.length) {
    const onlyNothing =
      selected.length === 1 && selected[0] === "nothing" && !hasEx && !hasFe && !hasDe;
    const selKey = q4SelectionKey(selected, hasEx, hasFe, hasDe);
    const out = selKey ? QUADRANT_4.output_by_selection[selKey] : "";
    const echo = selKey ? QUADRANT_4.echo_by_selection[selKey] : "";
    if (onlyNothing && out && echo) {
      const lead = "您选择：什么也不留";
      let body = `${out}\n${echo}`;
      const scan = `${ex} ${fe} ${de}`.trim();
      body = appendEmotion(body, scan);
      chunks.push(`${lead}\n\n${body}`);
    } else if (!onlyNothing && selKey && out && echo) {
      const lead = q4MultiLead(selected);
      if (lead) {
        let body = `${out}\n${echo}`;
        const scan = `${ex} ${fe} ${de}`.trim();
        body = appendEmotion(body, scan);
        chunks.push(`${lead}\n\n${body}`);
      }
    }
  }

  if (selected.indexOf("experience") >= 0 && hasEx) {
    const nt = normalizeQuoteText(ex);
    const user = formatUserSays(ex);
    const lf = lengthFlavorQ4Experience(nt);
    const parts = [];
    if (lf) parts.push(lf);
    const body = appendEmotion(parts.join("\n"), nt);
    chunks.push(body ? `${user}\n\n${body}` : user);
  }

  if (selected.indexOf("feeling") >= 0 && hasFe) {
    const nt = normalizeQuoteText(fe);
    const user = formatUserSays(fe);
    const lf = lengthFlavorQ4FeelingDecision(nt);
    const parts = [];
    if (lf) parts.push(lf);
    const body = appendEmotion(parts.join("\n"), nt);
    chunks.push(body ? `${user}\n\n${body}` : user);
  }

  if (selected.indexOf("decision") >= 0 && hasDe) {
    const nt = normalizeQuoteText(de);
    const user = formatUserSays(de);
    const lf = lengthFlavorQ4FeelingDecision(nt);
    const parts = [];
    if (lf) parts.push(lf);
    const body = appendEmotion(parts.join("\n"), nt);
    chunks.push(body ? `${user}\n\n${body}` : user);
  }

  return joinChunks(chunks);
}

/**
 * @param {number} quadrantId
 * @param {unknown[]} cardResponses
 * @returns {string[]}
 */
function buildQuadrantEchoParagraphs(quadrantId, cardResponses) {
  const cards = getQuadrantCards(quadrantId);
  const list = Array.isArray(cardResponses) ? cardResponses : [];
  let chunks = [];
  switch (Number(quadrantId)) {
    case 1:
      chunks = echoQ1(cards, list);
      break;
    case 2:
      chunks = echoQ2(cards, list);
      break;
    case 3:
      chunks = echoQ3(cards, list);
      break;
    case 4:
      chunks = echoQ4(cards, list);
      break;
    default:
      chunks = [];
  }
  if (!chunks.length) {
    return [FALLBACK_NO_ANSWER];
  }
  return chunks;
}

function buildGeneralClosingEcho() {
  return [GENERAL_SUMMARY.part_1, GENERAL_SUMMARY.part_2, GENERAL_SUMMARY.part_3];
}

module.exports = {
  formatUserSays,
  formatUserChoice,
  buildQuadrantEchoParagraphs,
  buildQuadrantEchoSegments: require("./reflectionReportSegments").buildQuadrantEchoSegments,
  buildGeneralClosingEcho,
  REPORT_COMBO_INTRO,
  REPORT_COMBO_OUTRO,
};
