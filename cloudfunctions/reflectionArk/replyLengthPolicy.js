"use strict";

const { charCount } = require("./normalizeText");
const {
  USER_TEXT_LONG_THRESHOLD,
  ARK_PROMPT_MIN_SHORT,
  ARK_PROMPT_MAX_SHORT,
  ARK_PROMPT_MIN_LONG,
  ARK_PROMPT_MAX_LONG,
  QUADRANT_Q2_ID,
  Q2_USER_TEXT_TIER1,
  Q2_USER_TEXT_TIER2,
  Q2_TIER1_MIN,
  Q2_TIER1_MAX,
  Q2_TIER1_SOFT_MAX,
  Q2_TIER2_MIN,
  Q2_TIER2_MAX,
  Q2_TIER2_SOFT_MAX,
  Q2_TIER3_MIN,
  Q2_TIER3_MAX,
  Q2_TIER3_SOFT_MAX,
  QUADRANT_Q1_ID,
  QUADRANT_Q3_ID,
  QUADRANT_Q4_ID,
  Q3_CHOICE_MIN,
  Q3_CHOICE_MAX,
  Q3_CHOICE_SOFT_MAX,
  Q3_USER_TEXT_TIER1,
  Q3_USER_TEXT_TIER2,
  Q3_TIER1_MIN,
  Q3_TIER1_MAX,
  Q3_TIER1_SOFT_MAX,
  Q3_TIER2_MIN,
  Q3_TIER2_MAX,
  Q3_TIER2_SOFT_MAX,
  Q3_TIER3_MIN,
  Q3_TIER3_MAX,
  Q3_TIER3_SOFT_MAX,
} = require("./constants");

function isChoiceApiUserText(userText) {
  return String(userText || "").includes("【用户选择】");
}

function isQ3ChoiceUserText(userText) {
  return isChoiceApiUserText(userText);
}

/**
 * 自我主宰：单选 c1 短档 + 手写分级
 * @param {string} userText
 * @returns {{ min: number, max: number, softMax: number, tier: string }}
 */
function getQ3ReplyLengthBounds(userText) {
  if (isQ3ChoiceUserText(userText)) {
    return {
      min: Q3_CHOICE_MIN,
      max: Q3_CHOICE_MAX,
      softMax: Q3_CHOICE_SOFT_MAX,
      tier: "q3_choice",
    };
  }
  const n = charCount(String(userText || "").trim());
  if (n <= Q3_USER_TEXT_TIER1) {
    return {
      min: Q3_TIER1_MIN,
      max: Q3_TIER1_MAX,
      softMax: Q3_TIER1_SOFT_MAX,
      tier: "q3_t1",
    };
  }
  if (n <= Q3_USER_TEXT_TIER2) {
    return {
      min: Q3_TIER2_MIN,
      max: Q3_TIER2_MAX,
      softMax: Q3_TIER2_SOFT_MAX,
      tier: "q3_t2",
    };
  }
  return {
    min: Q3_TIER3_MIN,
    max: Q3_TIER3_MAX,
    softMax: Q3_TIER3_SOFT_MAX,
    tier: "q3_t3",
  };
}

/**
 * 观心明己：按用户本题手写字数分级（短写短回，降低脑补凑字）
 * @param {string} userText
 * @returns {{ min: number, max: number, softMax: number, tier: string }}
 */
function getQ2ReplyLengthBounds(userText) {
  const n = charCount(String(userText || "").trim());
  if (n <= Q2_USER_TEXT_TIER1) {
    return {
      min: Q2_TIER1_MIN,
      max: Q2_TIER1_MAX,
      softMax: Q2_TIER1_SOFT_MAX,
      tier: "q2_t1",
    };
  }
  if (n <= Q2_USER_TEXT_TIER2) {
    return {
      min: Q2_TIER2_MIN,
      max: Q2_TIER2_MAX,
      softMax: Q2_TIER2_SOFT_MAX,
      tier: "q2_t2",
    };
  }
  return {
    min: Q2_TIER3_MIN,
    max: Q2_TIER3_MAX,
    softMax: Q2_TIER3_SOFT_MAX,
    tier: "q2_t3",
  };
}

/**
 * 按用户手写长度推算 AI 正文字数区间（报告页另有「小麒说：/小麟说：」前缀）
 * @param {string} userText
 * @param {number} [quadrantId]
 * @returns {{ min: number, max: number, softMax?: number, tier: string }}
 */
function getQ1ReplyLengthBounds(userText) {
  if (isChoiceApiUserText(userText)) {
    return {
      min: Q3_CHOICE_MIN,
      max: Q3_CHOICE_MAX,
      softMax: Q3_CHOICE_SOFT_MAX,
      tier: "q1_choice",
    };
  }
  const n = charCount(String(userText || "").trim());
  if (n <= Q3_USER_TEXT_TIER1) {
    return {
      min: Q3_TIER1_MIN,
      max: Q3_TIER1_MAX,
      softMax: Q3_TIER1_SOFT_MAX,
      tier: "q1_t1",
    };
  }
  if (n <= Q3_USER_TEXT_TIER2) {
    return {
      min: Q3_TIER2_MIN,
      max: Q3_TIER2_MAX,
      softMax: Q3_TIER2_SOFT_MAX,
      tier: "q1_t2",
    };
  }
  return {
    min: Q3_TIER3_MIN,
    max: Q3_TIER3_MAX,
    softMax: Q3_TIER3_SOFT_MAX,
    tier: "q1_t3",
  };
}

function getQ4ReplyLengthBounds(userText) {
  const n = charCount(String(userText || "").trim());
  if (n <= Q3_USER_TEXT_TIER1) {
    return {
      min: Q3_TIER1_MIN,
      max: Q3_TIER1_MAX,
      softMax: Q3_TIER1_SOFT_MAX,
      tier: "q4_t1",
    };
  }
  if (n <= Q3_USER_TEXT_TIER2) {
    return {
      min: Q3_TIER2_MIN,
      max: Q3_TIER2_MAX,
      softMax: Q3_TIER2_SOFT_MAX,
      tier: "q4_t2",
    };
  }
  return {
    min: Q3_TIER3_MIN,
    max: Q3_TIER3_MAX,
    softMax: Q3_TIER3_SOFT_MAX,
    tier: "q4_t3",
  };
}

function getReplyLengthBounds(userText, quadrantId) {
  if (Number(quadrantId) === QUADRANT_Q2_ID) {
    return getQ2ReplyLengthBounds(userText);
  }
  if (Number(quadrantId) === QUADRANT_Q3_ID) {
    return getQ3ReplyLengthBounds(userText);
  }
  if (Number(quadrantId) === QUADRANT_Q1_ID) {
    return getQ1ReplyLengthBounds(userText);
  }
  if (Number(quadrantId) === QUADRANT_Q4_ID) {
    return getQ4ReplyLengthBounds(userText);
  }

  const n = charCount(String(userText || "").trim());
  if (n <= USER_TEXT_LONG_THRESHOLD) {
    return {
      min: ARK_PROMPT_MIN_SHORT,
      max: ARK_PROMPT_MAX_SHORT,
      tier: "short",
    };
  }
  return {
    min: ARK_PROMPT_MIN_LONG,
    max: ARK_PROMPT_MAX_LONG,
    tier: "long",
  };
}

module.exports = {
  getReplyLengthBounds,
  getQ1ReplyLengthBounds,
  getQ2ReplyLengthBounds,
  getQ3ReplyLengthBounds,
  getQ4ReplyLengthBounds,
  isChoiceApiUserText,
  isQ3ChoiceUserText,
};
