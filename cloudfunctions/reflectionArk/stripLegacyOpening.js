"use strict";

/** 旧版开篇范式（正文内不再使用，展示/入库前剥离） */
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
 * @param {"xiaoqi"|"xiaolin"|string} agentType
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

module.exports = { stripLegacyOpening, LEGACY_OPENING_SNIPPETS };
