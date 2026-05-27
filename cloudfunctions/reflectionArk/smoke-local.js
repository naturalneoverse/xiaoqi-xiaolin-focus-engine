/**
 * 本地冒烟（不连云、不调方舟）：node cloudfunctions/reflectionArk/smoke-local.js
 */
"use strict";

const { buildTextHash } = require("./textHash");
const { desensitize } = require("./desensitize");
const { enforceReplyLength } = require("./replyLength");
const { extractReplyText } = require("./arkClient");
const { getFallbackReply, FALLBACK_REPLY } = require("./reflectionArkFallback");
const { stripLegacyOpening } = require("./stripLegacyOpening");
const { getPersonaSystem, isValidAgentType } = require("./personas");
const { charCount } = require("./normalizeText");
const { ARK_PROMPT_MAX_SHORT, ARK_PROMPT_MAX_LONG, REPLY_MIN_CHARS } = require("./constants");
const { validateGenerateReplyParams } = require("./validate");
const { loadArkEnv, isArkEnvReady, DEFAULT_MODEL_ID } = require("./env");
const { finalizeReplyContent } = require("./openingCheck");
const { getReplyLengthBounds } = require("./replyLengthPolicy");

function assert(cond, msg) {
  if (!cond) throw new Error(msg || "assert failed");
}

const { normalized, hash } = buildTextHash("  你好\r\n世界  ");
assert(normalized === "你好\n世界" || normalized.indexOf("你好") >= 0, "normalize");
assert(hash.length === 64, "sha256 hex");

const masked = desensitize("联系我13812345678");
assert(masked.indexOf("13812345678") < 0, "desensitize phone");

const mockArk = {
  output: [
    {
      type: "message",
      content: [{ type: "text", text: "针对您此刻的觉察，值得被温柔地看见。".repeat(12) }],
    },
  ],
};
const extracted = extractReplyText(mockArk);
assert(charCount(extracted) >= 20, "extractReplyText");

const fb = getFallbackReply("xiaoqi");
assert(fb === FALLBACK_REPLY, "fallback short");
assert(charCount(fb) < REPLY_MIN_CHARS, "fallback not padded");

const stripped = stripLegacyOpening(
  "静守本心观照内在，小麟愿轻声伴您抚平心绪。正文保留。",
  "xiaolin",
);
assert(stripped.indexOf("静守本心") < 0, "strip legacy");
assert(stripped.indexOf("正文保留") >= 0, "strip keeps body");

const shortBounds = getReplyLengthBounds("难");
const adjusted = enforceReplyLength("短。", shortBounds, { neverPad: true });
assert(charCount(adjusted) <= ARK_PROMPT_MAX_SHORT + 2, "enforce short tier max");
assert(adjusted === "短。", "neverPad no pad");
assert(adjusted.indexOf("静守本心") < 0, "enforce no opening");

const finalized = finalizeReplyContent(
  "心怀远志，步履方有方向，小麒与您一同理清前路方寸。您愿意面对难处的坚持，本身就是在向前。",
  "xiaoqi",
  "难",
);
assert(finalized.indexOf("心怀远志") < 0, "finalize no opening");
assert(charCount(finalized) <= ARK_PROMPT_MAX_SHORT + 2, "finalize short user max");

const env = loadArkEnv();
assert(env.modelId === DEFAULT_MODEL_ID, "default model id when env unset");

assert(isValidAgentType("xiaolin") && getPersonaSystem("xiaolin").indexOf("小麟") >= 0, "persona");

const bad = validateGenerateReplyParams({ taskId: "", quadrantId: 9, cardField: "x", userText: "a", agentType: "x" });
assert(!bad.ok, "validate reject");

const good = validateGenerateReplyParams({
  taskId: "t1",
  quadrantId: 2,
  cardField: "c0",
  userText: "测试内容",
  agentType: "xiaolin",
});
assert(good.ok, "validate ok");

if (!isArkEnvReady(loadArkEnv())) {
  console.log("[reflectionArk smoke-local] skip live ARK (env not set)");
}

console.log("[reflectionArk smoke-local] OK (opening: npm test)");
