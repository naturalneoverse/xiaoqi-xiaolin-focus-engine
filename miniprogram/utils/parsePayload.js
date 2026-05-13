/** 任务创建链路等页面 onLoad options.payload 解码 */
function parsePayload(payload) {
  try {
    return payload ? JSON.parse(decodeURIComponent(payload)) : {};
  } catch (e) {
    return {};
  }
}

module.exports = {
  parsePayload,
};
