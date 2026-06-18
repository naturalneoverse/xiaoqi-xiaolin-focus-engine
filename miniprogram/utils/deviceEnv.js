/**
 * 微信 PC / Mac 客户端能力差异（日历、闹钟等仅手机可用）。
 */

function readPlatform() {
  try {
    const sys =
      typeof wx.getDeviceInfo === "function" ? wx.getDeviceInfo() : wx.getSystemInfoSync();
    return String((sys && sys.platform) || "").toLowerCase();
  } catch (e) {
    return "";
  }
}

function isDesktopWechat() {
  const p = readPlatform();
  return p === "windows" || p === "mac" || p === "devtools";
}

/** 华为/鸿蒙等机型 addPhoneRepeatCalendar 易报 wrong format:repeat，改走逐日写入 */
function shouldSkipRepeatCalendar() {
  try {
    const sys =
      typeof wx.getDeviceInfo === "function" ? wx.getDeviceInfo() : wx.getSystemInfoSync();
    const brand = String((sys && sys.brand) || "").toLowerCase();
    const model = String((sys && sys.model) || "").toLowerCase();
    const system = String((sys && sys.system) || "").toLowerCase();
    if (system.includes("harmony") || system.includes("hongmeng")) return true;
    if (brand.includes("huawei") || brand.includes("honor")) return true;
    if (model.includes("huawei") || model.includes("honor")) return true;
    return false;
  } catch (e) {
    return false;
  }
}

/**
 * 电脑端同步提示：立即弹窗，避免先走 addPhoneCalendar 再等系统「在手机上打开」延迟出现。
 * @param {{ feature?: string }} [opts]
 * @returns {Promise<boolean>} 用户点了「知道了」为 true
 */
function showMobileOnlyModal(opts) {
  const feature = (opts && opts.feature) || "日历提醒";
  return new Promise((resolve) => {
    wx.showModal({
      title: "请在手机上操作",
      content:
        `${feature}需在手机微信中使用。您可先在电脑填写任务，保存后到手机打开本小程序完成提醒设置。`,
      showCancel: false,
      confirmText: "知道了",
      confirmColor: "#12598f",
      success: (res) => resolve(!!(res && res.confirm)),
      fail: () => resolve(false),
    });
  });
}

module.exports = {
  readPlatform,
  isDesktopWechat,
  shouldSkipRepeatCalendar,
  showMobileOnlyModal,
};
