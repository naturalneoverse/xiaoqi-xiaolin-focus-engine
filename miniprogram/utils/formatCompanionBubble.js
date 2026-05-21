/**
 * 任务庆祝弹窗：将 companionText（fullPrefix + reply）拆成展示行，不删改原文。
 * 适配云库 fullPrefix 以「恭喜您完成全部选择，」开头的结构。
 */

const INTRO_CORE = "恭喜您完成全部选择";

function splitPrefixAndReply(companionText) {
  const raw = String(companionText || "").trim();
  if (!raw) return { fullPrefix: "", reply: "" };

  const parts = raw.split(/\n/).map((s) => s.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return {
      fullPrefix: parts.slice(0, -1).join("\n"),
      reply: parts[parts.length - 1],
    };
  }

  const idx = raw.search(/小麒看见/);
  if (idx > 0) {
    return {
      fullPrefix: raw.slice(0, idx).trim(),
      reply: raw.slice(idx).trim(),
    };
  }

  return { fullPrefix: raw, reply: "" };
}

function splitFullPrefixLines(fullPrefix) {
  const prefix = String(fullPrefix || "").trim();
  if (!prefix) return [];

  if (prefix.indexOf(INTRO_CORE) !== 0) {
    return [prefix];
  }

  const rest = prefix.slice(INTRO_CORE.length).replace(/^[，,]\s*/, "");
  const line1 = INTRO_CORE;
  if (!rest) return [line1];
  return [line1, rest];
}

/**
 * @param {string} companionText 任务上存储的完整陪伴语（未删减）
 * @returns {string[]|null} 展示行；无法解析时返回 null 由调用方回退 chat-bubble
 */
function formatCompanionBubbleLines(companionText) {
  const raw = String(companionText || "").trim();
  if (!raw) return null;

  const { fullPrefix, reply } = splitPrefixAndReply(raw);
  const lines = splitFullPrefixLines(fullPrefix);

  if (reply) {
    lines.push(reply);
  }

  return lines.length ? lines : null;
}

module.exports = {
  INTRO_CORE,
  formatCompanionBubbleLines,
  splitPrefixAndReply,
  splitFullPrefixLines,
};
