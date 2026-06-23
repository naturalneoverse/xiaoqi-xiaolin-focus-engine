/**
 * 每日打卡：本地为主，云端 merge 备份（换机 / 清缓存后可恢复累计天数）。
 * 开发版与正式版共用同一 appId 的本地 Storage 与云环境，须先回补业务痕迹再与云合并。
 */
const dailyCheckIn = require("./dailyCheckIn");

let _pushTimer = null;
let _pullInflight = null;

function parseCloudResult(res) {
  let raw = res && res.result;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch (e) {
      /* ignore */
    }
  }
  return raw && typeof raw === "object" ? raw : null;
}

async function ensureCloudCallable() {
  try {
    const cloudDataSync = require("./cloudDataSync");
    if (cloudDataSync && typeof cloudDataSync.ensureCloudCallable === "function") {
      return cloudDataSync.ensureCloudCallable();
    }
  } catch (e) {
    /* ignore */
  }
  return !!(wx.cloud && typeof wx.cloud.callFunction === "function");
}

function canSync() {
  try {
    const auth = require("./authSession");
    return auth && typeof auth.isLoggedIn === "function" && auth.isLoggedIn();
  } catch (e) {
    return false;
  }
}

async function pullCheckInsFromCloud() {
  if (!wx.cloud || typeof wx.cloud.callFunction !== "function") return null;
  try {
    const res = await wx.cloud.callFunction({
      name: "quickstartFunctions",
      data: { type: "getCheckInDates" },
    });
    const raw = parseCloudResult(res);
    if (!raw || !raw.success || !Array.isArray(raw.dates)) return null;
    return raw.dates;
  } catch (e) {
    console.warn("[checkInCloudSync] getCheckInDates", e);
    return null;
  }
}

async function mergeCheckInsToCloud(localDates) {
  if (!wx.cloud || typeof wx.cloud.callFunction !== "function") return null;
  try {
    const res = await wx.cloud.callFunction({
      name: "quickstartFunctions",
      data: {
        type: "mergeCheckInDates",
        dates: localDates,
      },
    });
    const raw = parseCloudResult(res);
    if (!raw || !raw.success || !Array.isArray(raw.dates)) return null;
    return raw.dates;
  } catch (e) {
    console.warn("[checkInCloudSync] mergeCheckInDates", e);
    return null;
  }
}

/**
 * 业务回补 → 云只读拉取 → 云并集写回 → 记今日。
 */
async function pullAndMergeCheckIns() {
  dailyCheckIn.repairCheckInsFromActivity(true);

  if (!canSync()) {
    dailyCheckIn.recordDailyCheckIn();
    return dailyCheckIn.readCheckInDateKeys();
  }

  if (_pullInflight) return _pullInflight;

  _pullInflight = (async () => {
    const localBefore = dailyCheckIn.readCheckInDateKeysWithRecovery();

    if (!(await ensureCloudCallable())) {
      dailyCheckIn.recordDailyCheckIn();
      return dailyCheckIn.readCheckInDateKeys();
    }

    const cloudPull = await pullCheckInsFromCloud();
    const localAfterPull = dailyCheckIn.mergeAndPersistCheckIns([localBefore], cloudPull || []);

    const cloudMerged = await mergeCheckInsToCloud(localAfterPull);
    const localDuring = dailyCheckIn.readCheckInDateKeysWithRecovery();

    const merged = dailyCheckIn.mergeAndPersistCheckIns(
      [localBefore, localAfterPull, localDuring],
      cloudMerged || cloudPull || [],
    );
    dailyCheckIn.recordDailyCheckIn();
    return merged;
  })()
    .catch((e) => {
      console.warn("[checkInCloudSync] pullAndMergeCheckIns", e);
      dailyCheckIn.recordDailyCheckIn();
      return dailyCheckIn.readCheckInDateKeys();
    })
    .finally(() => {
      _pullInflight = null;
    });

  return _pullInflight;
}

function schedulePushCheckIns() {
  if (!canSync()) return;
  if (_pushTimer) clearTimeout(_pushTimer);
  _pushTimer = setTimeout(() => {
    _pushTimer = null;
    pullAndMergeCheckIns().catch((e) => {
      console.warn("[checkInCloudSync] schedulePushCheckIns", e);
    });
  }, 1800);
}

module.exports = {
  pullAndMergeCheckIns,
  schedulePushCheckIns,
};
