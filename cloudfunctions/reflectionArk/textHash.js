"use strict";

const crypto = require("crypto");
const { normalizeText } = require("./normalizeText");

/**
 * @param {string} text 原始或已归一化文本
 * @returns {{ normalized: string, hash: string }}
 */
function buildTextHash(text) {
  const normalized = normalizeText(text);
  const hash = crypto.createHash("sha256").update(normalized, "utf8").digest("hex");
  return { normalized, hash };
}

module.exports = { buildTextHash };
