/**
 * 哲思报告对话行：您说 / 小麒说 / 小麟说（仅手写 AI 段使用）
 */

const AGENT_SAY_PREFIX = {
  xiaoqi: "小麒说：",
  xiaolin: "小麟说：",
};

const LEGACY_OPENING_SNIPPETS = {
  xiaoqi: [
    "心怀远志，步履方有方向，小麒与您一同理清前路方寸",
    "心怀远志",
    "小麒与您一同理清前路方寸",
  ],
  xiaolin: [
    "静守本心观照内在，小麟愿轻声伴您抚平心绪",
    "静守本心",
    "小麟愿轻声伴您抚平心绪",
  ],
};

/**
 * @param {string} text
 * @param {"xiaoqi"|"xiaolin"|string} [agentType]
 * @returns {string}
 */
function stripLegacyOpening(text, agentType) {
  let s = String(text || "").replace(/\s+/g, " ").trim();
  if (!s) return "";

  const t = String(agentType || "").toLowerCase();
  const snippets = (LEGACY_OPENING_SNIPPETS[t] || []).concat(
    LEGACY_OPENING_SNIPPETS.xiaoqi,
    LEGACY_OPENING_SNIPPETS.xiaolin,
  );

  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < snippets.length; i++) {
      const snip = snippets[i];
      if (!snip || s.indexOf(snip) !== 0) continue;
      let rest = s.slice(snip.length).replace(/^[，,、\s]+/, "").trim();
      if (rest && !/[。！？.!?]/.test(rest.charAt(0))) {
        rest = rest.replace(/^[，,、]/, "").trim();
      }
      s = rest;
      changed = true;
    }
    const m = s.match(/^[^。！？.!?]{0,80}[。！？.!?]/);
    if (m && (m[0].indexOf("小麒") >= 0 || m[0].indexOf("小麟") >= 0)) {
      if (
        m[0].indexOf("与您") >= 0 ||
        m[0].indexOf("愿轻声") >= 0 ||
        m[0].indexOf("心怀远志") >= 0 ||
        m[0].indexOf("静守本心") >= 0
      ) {
        s = s.slice(m[0].length).trim();
        changed = true;
      }
    }
  }
  return s.trim();
}

/**
 * @param {"xiaoqi"|"xiaolin"|string} agentType
 * @returns {string}
 */
function getAgentSayPrefix(agentType) {
  const t = String(agentType || "").toLowerCase();
  return AGENT_SAY_PREFIX[t] || AGENT_SAY_PREFIX.xiaolin;
}

/**
 * @param {"xiaoqi"|"xiaolin"|string} agentType
 * @param {string} body
 * @returns {string}
 */
function formatAgentSays(agentType, body) {
  const prefix = getAgentSayPrefix(agentType);
  const b = stripLegacyOpening(body, agentType);
  return b ? `${prefix}${b}` : prefix;
}

module.exports = {
  AGENT_SAY_PREFIX,
  getAgentSayPrefix,
  stripLegacyOpening,
  formatAgentSays,
};
