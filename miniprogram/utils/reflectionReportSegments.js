/**
 * 复盘报告分段：选择题本地段 + 手写段（解读由缓存/兜底拼装，不走 echoQ* 长文）
 */

const {
  getQuadrantCards,
  resolveSingleSelected,
} = require("../config/reflectionQuadrantCards");
const { formatSingleChoiceUserText } = require("../config/reflectionArkApiMap");
const { getQuadrantMeta } = require("../config/reflectionTheme");
const {
  QUADRANT_2,
  QUADRANT_3,
  QUADRANT_4,
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

function respAt(cards, cardResponses, index) {
  return (cardResponses && cardResponses[index]) || null;
}

function optionLabel(card, id) {
  if (!card || !card.options || !id) return "";
  const o = card.options.find((x) => x && x.id === id);
  return o && o.label ? String(o.label) : "";
}

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
      /* ignore */
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

function agentForQuadrant(quadrantId) {
  const meta = getQuadrantMeta(quadrantId);
  return meta && meta.agent ? meta.agent : "xiaolin";
}

function pushHandwriting(segments, cardField, userText, quadrantId, extra) {
  if (!hasAnyText(userText)) return;
  segments.push(
    Object.assign(
      {
        type: "handwriting",
        cardField: String(cardField),
        userText: String(userText).trim(),
        agentType: agentForQuadrant(quadrantId),
      },
      extra || null,
    ),
  );
}

function pushChoice(segments, echoText) {
  const t = String(echoText || "").trim();
  if (!t) return;
  segments.push({ type: "choice", echoText: t });
}

function segmentQ1(cards, cardResponses) {
  const segments = [];
  const r0 = respAt(cards, cardResponses, 0);
  const r1 = respAt(cards, cardResponses, 1);
  const r2 = respAt(cards, cardResponses, 2);
  const card1 = cards[1];
  const t0 = r0 && r0.type === "text" ? r0.text : "";
  const t2 = r2 && r2.type === "text" ? r2.text : "";

  pushHandwriting(segments, "c0", t0, 1);

  if (card1 && card1.type === "single" && r1 && r1.type === "single") {
    const id = resolveSingleSelected(card1, r1);
    if (id) {
      const label = optionLabel(card1, id) || id;
      const userText = formatSingleChoiceUserText(card1.question, label);
      pushHandwriting(segments, "c1", userText, 1, { choiceLabel: label });
    }
  }

  pushHandwriting(segments, "c2", t2, 1);
  return segments;
}

function segmentQ2(cards, cardResponses) {
  const segments = [];
  for (let idx = 0; idx < 3; idx++) {
    const r = respAt(cards, cardResponses, idx);
    const raw = r && r.type === "text" ? r.text : "";
    pushHandwriting(segments, `c${idx}`, raw, 2);
  }
  return segments;
}

function segmentQ3(cards, cardResponses) {
  const segments = [];
  const r0 = respAt(cards, cardResponses, 0);
  const r1 = respAt(cards, cardResponses, 1);
  const r2 = respAt(cards, cardResponses, 2);
  const card1 = cards[1];
  const t0 = r0 && r0.type === "text" ? r0.text : "";
  const t2 = r2 && r2.type === "text" ? r2.text : "";

  pushHandwriting(segments, "c0", t0, 3);

  if (card1 && card1.type === "single" && r1 && r1.type === "single") {
    const id = resolveSingleSelected(card1, r1);
    if (id) {
      const label = optionLabel(card1, id) || id;
      const userText = formatSingleChoiceUserText(card1.question, label);
      pushHandwriting(segments, "c1", userText, 3, { choiceLabel: label });
    }
  }

  pushHandwriting(segments, "c2", t2, 3);
  return segments;
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

function segmentQ4(cards, cardResponses) {
  const segments = [];
  const r0 = respAt(cards, cardResponses, 0);
  const r1 = respAt(cards, cardResponses, 1);
  const r2 = respAt(cards, cardResponses, 2);

  pushHandwriting(segments, "c0", r0 && r0.type === "text" ? r0.text : "", 4);
  pushHandwriting(segments, "c1", r1 && r1.type === "text" ? r1.text : "", 4);

  if (!r2 || r2.type !== "multi") return segments;

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
      body = appendEmotion(body, `${ex} ${fe} ${de}`.trim());
      pushChoice(segments, `${lead}\n\n${body}`);
    } else if (!onlyNothing && selKey && out && echo) {
      const lead = q4MultiLead(selected);
      if (lead) {
        let body = `${out}\n${echo}`;
        body = appendEmotion(body, `${ex} ${fe} ${de}`.trim());
        pushChoice(segments, `${lead}\n\n${body}`);
      }
    }
  }

  if (selected.indexOf("experience") >= 0 && hasEx) {
    pushHandwriting(segments, "c2_experience", ex, 4);
  }
  if (selected.indexOf("feeling") >= 0 && hasFe) {
    pushHandwriting(segments, "c2_feeling", fe, 4);
  }
  if (selected.indexOf("decision") >= 0 && hasDe) {
    pushHandwriting(segments, "c2_decision", de, 4);
  }

  return segments;
}

/**
 * @param {number} quadrantId
 * @param {unknown[]} cardResponses
 * @returns {{ type: string, cardField?: string, userText?: string, agentType?: string, echoText?: string }[]}
 */
function buildQuadrantEchoSegments(quadrantId, cardResponses) {
  const cards = getQuadrantCards(quadrantId);
  const list = Array.isArray(cardResponses) ? cardResponses : [];
  switch (Number(quadrantId)) {
    case 1:
      return segmentQ1(cards, list);
    case 2:
      return segmentQ2(cards, list);
    case 3:
      return segmentQ3(cards, list);
    case 4:
      return segmentQ4(cards, list);
    default:
      return [];
  }
}

module.exports = {
  buildQuadrantEchoSegments,
};
