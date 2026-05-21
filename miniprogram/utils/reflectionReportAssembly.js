/**
 * 报告页：本地选择题段 + 手写段（缓存解读 / 温和兜底）拼装
 */

const { formatUserSays } = require("./reflectionReportNarrative");
const { formatAgentSays, stripLegacyOpening } = require("./reflectionReportDialogue");
const { buildQuadrantEchoSegments } = require("./reflectionReportSegments");
const { buildTextHash } = require("./reflectionArkTextHash");
const { getFallbackReply } = require("../config/reflectionArkFallback");
const { FALLBACK_NO_ANSWER } = require("../config/reflectionReportNarrativeSpec");

const EMOJI_RE =
  /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F000}-\u{1FAFF}]/gu;

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
 * @returns {string}
 */
function resolveHandwritingReply(cacheReplyMap, segment) {
  const cardField = String(segment.cardField || "");
  const userText = String(segment.userText || "");
  const { hash } = buildTextHash(userText);
  const key = `${cardField}:${hash}`;
  const cached = cacheReplyMap && cacheReplyMap[key];
  if (cached && String(cached).trim()) return String(cached).trim();
  return getFallbackReply(segment.agentType);
}

/**
 * @param {number} quadrantId
 * @param {unknown[]} cardResponses
 * @param {Record<string, string>} cacheReplyMap
 * @returns {{ echoKey: string, echoText: string }[]}
 */
function assembleQuadrantEchoParagraphs(quadrantId, cardResponses, cacheReplyMap) {
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
      const userLine = formatUserSays(seg.userText);
      const reply = resolveHandwritingReply(cacheReplyMap, seg);
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
  stripEmoji,
};
