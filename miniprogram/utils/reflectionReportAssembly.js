/**
 * 报告页：本地选择题段 + 手写段（缓存解读 / 温和兜底）拼装
 */

const { formatUserSays, formatUserChoice } = require("./reflectionReportNarrative");
const { parseSingleChoiceUserText } = require("../config/reflectionArkApiMap");
const { formatAgentSays, stripLegacyOpening } = require("./reflectionReportDialogue");
const { buildQuadrantEchoSegments } = require("./reflectionReportSegments");
const { buildTextHash } = require("./reflectionArkTextHash");
const {
  getFallbackReply,
  getPendingHandwritingReply,
  getQ2MissingHandwritingReply,
  getQ1MissingHandwritingReply,
  getQ3MissingHandwritingReply,
  getQ4MissingHandwritingReply,
  isFallbackReply,
  isPendingHandwritingReply,
} = require("../config/reflectionArkFallback");
const { assessArkReplyForCard } = require("./reflectionArkReplyQuality");
const { FALLBACK_NO_ANSWER } = require("../config/reflectionReportNarrativeSpec");

const EMOJI_RE =
  /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F000}-\u{1FAFF}]/gu;

function formatUserLineForSegment(seg) {
  if (seg && seg.choiceLabel) {
    return formatUserChoice(seg.choiceLabel);
  }
  const text = String((seg && seg.userText) || "");
  const fromApi = parseSingleChoiceUserText(text);
  if (fromApi) {
    return formatUserChoice(fromApi);
  }
  return formatUserSays(text);
}

function stripEmoji(text) {
  let s = String(text || "");
  try {
    s = s.replace(EMOJI_RE, "");
  } catch (e) {
    s = s.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, "");
  }
  return s.replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * @param {Record<string, string>} cacheReplyMap  key: cardField:textHash
 * @param {{ type: string, cardField?: string, userText?: string, agentType?: string, echoText?: string }} segment
 * @param {string[]} [pendingCardFields]
 * @returns {string}
 */
function resolveHandwritingReply(cacheReplyMap, segment, pendingCardFields, fallbackSetIndex) {
  const cardField = String(segment.cardField || "");
  const userText = String(segment.userText || "");
  const { hash } = buildTextHash(userText);
  const key = `${cardField}:${hash}`;
  const cached = cacheReplyMap && cacheReplyMap[key];
  const cachedTrim = cached != null ? String(cached).trim() : "";
  const quadrantId = Number(segment.quadrantId);
  if (cachedTrim) {
    if (isPendingHandwritingReply(cachedTrim)) return cachedTrim;
    if (isFallbackReply(cachedTrim)) return cachedTrim;
    if (assessArkReplyForCard(quadrantId, cardField, cachedTrim).ok) return cachedTrim;
  }
  const pending = pendingCardFields || [];
  if (pending.indexOf(cardField) >= 0) {
    return getPendingHandwritingReply(segment.agentType);
  }
  if (quadrantId === 2) {
    return getQ2MissingHandwritingReply();
  }
  if (quadrantId === 1) {
    return getQ1MissingHandwritingReply();
  }
  if (quadrantId === 3) {
    return getQ3MissingHandwritingReply();
  }
  if (quadrantId === 4) {
    return getQ4MissingHandwritingReply();
  }
  return getFallbackReply(quadrantId, cardField, {
    setIndex: fallbackSetIndex,
  });
}

/**
 * @param {number} quadrantId
 * @param {unknown[]} cardResponses
 * @param {Record<string, string>} cacheReplyMap
 * @param {string[]} [pendingCardFields]
 * @param {number} [fallbackSetIndex] 整卷统一套系 0..5
 * @returns {{ echoKey: string, echoText: string }[]}
 */
function assembleQuadrantEchoParagraphs(
  quadrantId,
  cardResponses,
  cacheReplyMap,
  pendingCardFields,
  fallbackSetIndex,
) {
  const segments = buildQuadrantEchoSegments(quadrantId, cardResponses);
  if (!segments.length) {
    return [{ echoKey: `q${quadrantId}-empty`, echoText: stripEmoji(FALLBACK_NO_ANSWER) }];
  }

  const paragraphs = [];
  segments.forEach((seg, idx) => {
    if (!seg || !seg.type) return;
    const echoKey = `q${quadrantId}-${seg.type}-${seg.cardField || idx}-${idx}`;

    if (seg.type === "choice") {
      paragraphs.push({
        echoKey,
        echoText: stripEmoji(seg.echoText),
      });
      return;
    }

    if (seg.type === "handwriting") {
      const userLine = formatUserLineForSegment(seg);
      const reply = resolveHandwritingReply(
        cacheReplyMap,
        Object.assign({ quadrantId }, seg),
        pendingCardFields,
        fallbackSetIndex,
      );
      const body = stripLegacyOpening(reply, seg.agentType);
      const agentLine = formatAgentSays(seg.agentType, body);
      const echoText = stripEmoji(agentLine ? `${userLine}\n\n${agentLine}` : userLine);
      if (echoText) {
        paragraphs.push({ echoKey, echoText });
      }
    }
  });

  return paragraphs.length
    ? paragraphs
    : [{ echoKey: `q${quadrantId}-fallback`, echoText: stripEmoji(FALLBACK_NO_ANSWER) }];
}

module.exports = {
  assembleQuadrantEchoParagraphs,
  resolveHandwritingReply,
  stripEmoji,
};
