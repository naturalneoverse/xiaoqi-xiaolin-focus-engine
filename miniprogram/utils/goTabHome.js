/**
 * Tab 页路径（与 app.json tabBar.list 的 pagePath 一致，无前导 /）。
 * @param {string} path 如 pages/sleep/index、pages/index/index
 */
function switchTabRobust(path) {
  const raw = String(path || "")
    .trim()
    .replace(/^\//, "");
  if (!raw) return;
  wx.reLaunch({
    url: `/${raw}`,
    fail: (e1) => {
      console.warn("[switchTabRobust] reLaunch fail", raw, e1);
      wx.switchTab({
        url: raw,
        fail: (e2) => {
          console.warn("[switchTabRobust] switchTab fail", raw, e2);
          wx.switchTab({ url: `/${raw}` });
        },
      });
    },
  });
}

/** 进入「时间」Tab 首页 */
function goSleepHome() {
  switchTabRobust("pages/sleep/index");
}

/** 进入「身心」Tab 首页 */
function goMindHome() {
  switchTabRobust("pages/index/index");
}

/** 进入「我的」Tab */
function goMyHome() {
  switchTabRobust("pages/my/index");
}

module.exports = {
  goSleepHome,
  goMindHome,
  goMyHome,
  switchTabRobust,
};
