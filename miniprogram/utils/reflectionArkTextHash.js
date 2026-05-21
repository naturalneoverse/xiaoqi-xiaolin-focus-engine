const { normalizeText } = require("./reflectionArkNormalize");
const { sha256Hex } = require("./reflectionArkSha256");

/**
 * @param {string} text
 * @returns {{ normalized: string, hash: string }}
 */
function buildTextHash(text) {
  const normalized = normalizeText(text);
  const hash = sha256Hex(normalized);
  return { normalized, hash };
}

module.exports = { buildTextHash };
