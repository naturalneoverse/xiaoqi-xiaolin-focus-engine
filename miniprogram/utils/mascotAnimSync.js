/** 切后台暂停 / 回前台恢复：同步各页 mascot 呼吸动画状态 */
function syncMascotAnimPaused(paused) {
  const pages = getCurrentPages();
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    if (page && typeof page.setData === "function") {
      page.setData({ mascotAnimPaused: !!paused });
    }
  }
}

module.exports = {
  syncMascotAnimPaused,
};
