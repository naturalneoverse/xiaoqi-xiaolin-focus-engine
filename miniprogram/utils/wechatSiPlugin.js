/** 微信同声传译插件单例加载 */

let cachedPlugin = null;

function getWechatSI() {
  if (cachedPlugin) return cachedPlugin;
  try {
    const plugin = requirePlugin("WechatSI");
    if (plugin && typeof plugin.getRecordRecognitionManager === "function") {
      cachedPlugin = plugin;
      return plugin;
    }
    return null;
  } catch (e) {
    return null;
  }
}

function resetWechatSICache() {
  cachedPlugin = null;
}

module.exports = {
  getWechatSI,
  resetWechatSICache,
};
