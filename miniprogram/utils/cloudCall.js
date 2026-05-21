/**
 * 云函数调用封装：避免模拟器长时间无响应（超时后 reject）
 */

const DEFAULT_TIMEOUT_MS = 12000;

function isCloudReady() {
  if (!wx.cloud || typeof wx.cloud.callFunction !== "function") return false;
  try {
    const app = getApp();
    return !!(app && app.globalData && app.globalData.cloudInitOk);
  } catch (e) {
    return false;
  }
}

/**
 * @param {{ name: string, data?: object }} options
 * @param {number} [timeoutMs]
 */
function callFunction(options, timeoutMs) {
  const ms = Number(timeoutMs) > 0 ? Number(timeoutMs) : DEFAULT_TIMEOUT_MS;
  if (!isCloudReady()) {
    return Promise.reject(new Error("cloud not ready"));
  }
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error("cloud call timeout"));
    }, ms);
    wx.cloud
      .callFunction(options)
      .then((res) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(err);
      });
  });
}

module.exports = {
  callFunction,
  isCloudReady,
  DEFAULT_TIMEOUT_MS,
};
