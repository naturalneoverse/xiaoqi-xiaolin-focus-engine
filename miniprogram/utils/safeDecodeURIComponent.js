/**
 * 解码路由 query 参数；非法 % 转义时 decodeURIComponent 会抛 URIError，此处回落为原字符串。
 * @param {unknown} val
 * @returns {string}
 */
function safeDecodeURIComponent(val) {
  if (val == null || val === "") return "";
  const s = String(val);
  try {
    return decodeURIComponent(s);
  } catch (e) {
    return s;
  }
}

module.exports = {
  safeDecodeURIComponent,
};
