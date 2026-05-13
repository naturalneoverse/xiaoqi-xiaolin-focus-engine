/** 与本地打卡、日报等一致的「今天」键 yyyy-MM-dd */
function getTodayKey() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

module.exports = {
  getTodayKey,
};
