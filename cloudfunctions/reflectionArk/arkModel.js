"use strict";

const { QUADRANT_Q1_ID, QUADRANT_Q2_ID, QUADRANT_Q3_ID, QUADRANT_Q4_ID } = require("./constants");

/**
 * 按象限解析方舟 model（Endpoint ID）
 * Q1 混元 · Q2/Q3 阶段 B DeepSeek · Q4 千问 · 默认豆包
 * @param {object} env loadArkEnv()
 * @param {number} quadrantId
 * @param {"stage_a"|"stage_b"|"default"} [phase]
 * @returns {string}
 */
function resolveArkModelId(env, quadrantId, phase) {
  const e = env || {};
  const q = Number(quadrantId);
  const p = String(phase || "default");

  if (q === QUADRANT_Q1_ID && e.modelIdQ1) {
    return e.modelIdQ1;
  }
  if (q === QUADRANT_Q4_ID && e.modelIdQ4) {
    return e.modelIdQ4;
  }
  if ((q === QUADRANT_Q2_ID || q === QUADRANT_Q3_ID) && p === "stage_b" && e.modelIdQ2Deep) {
    return e.modelIdQ2Deep;
  }
  return e.modelId || "";
}

module.exports = { resolveArkModelId };
