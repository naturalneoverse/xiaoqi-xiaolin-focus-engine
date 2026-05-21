/**
 * SHA256 hex（MIT js-sha256@0.11.0，与 Node crypto 及云函数 textHash 对齐）
 */
const sha256 = require("./sha256Lib");

function sha256Hex(message) {
  return sha256(String(message || ""));
}

module.exports = { sha256Hex };
