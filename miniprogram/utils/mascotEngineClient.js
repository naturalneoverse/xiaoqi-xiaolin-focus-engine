/**
 * 调用独立云函数 mascotEngine（与 quickstartFunctions / getMascotCopy 并存）。
 * 今日身体：scene body_daily + subType 形如 sleep_睡得香。
 */

const DATA_SCHEMA_VERSION = "1";

const KNOWN_DIM_VALUES = {
  sleep: ["睡得香", "做梦了", "睡不实", "睡不着"],
  sport: ["动够了", "动了点", "没咋动", "动过头了"],
  signal: ["没事", "有劲", "累了", "疼了"],
};

function pickBodyDailySubType(record) {
  if (!record) return null;
  const tryDim = (dim) => {
    const v = record[dim];
    if (!v || v === "未记录") return null;
    const allowed = KNOWN_DIM_VALUES[dim];
    if (!allowed || allowed.indexOf(v) < 0) return null;
    return `${dim}_${v}`;
  };
  if (record.signal && record.signal !== "未记录" && record.signal !== "没事") {
    const k = tryDim("signal");
    if (k) return k;
  }
  const order = ["sleep", "sport", "signal"];
  for (let i = 0; i < order.length; i += 1) {
    const k = tryDim(order[i]);
    if (k) return k;
  }
  return null;
}

/**
 * @param {object|null} record 当日末条身体记录；null 表示无记录（走云端中性句）
 * @returns {Promise<string|null>} 成功返回文案；失败或不可用返回 null，由页面走 buildInstantFeedback 等兜底
 */
function fetchMascotEngineBodyDaily(record) {
  return new Promise((resolve) => {
    if (!wx.cloud || typeof wx.cloud.callFunction !== "function") {
      resolve(null);
      return;
    }
    const data = {
      scene: "body_daily",
      dataSchemaVersion: DATA_SCHEMA_VERSION,
    };
    const subType = record ? pickBodyDailySubType(record) : null;
    if (subType) data.subType = subType;

    wx.cloud
      .callFunction({
        name: "mascotEngine",
        data,
      })
      .then((resp) => {
        const r = (resp && resp.result) || {};
        if (r.success === false) {
          resolve(null);
          return;
        }
        const text = r.text && String(r.text).trim() ? r.text : null;
        resolve(text);
      })
      .catch((e) => {
        console.error("mascotEngine body_daily", e);
        resolve(null);
      });
  });
}

/**
 * 身体周报：传入 mascotCopyStats.buildBodyWeekStats 的结果（含 hits）。
 */
/**
 * 时间编织周报：传入 mascotCopyStats.buildWeeklyTimeStats 的结果（含 hits）。
 */
function fetchMascotEngineWeeklyTime(stats) {
  return new Promise((resolve) => {
    if (!wx.cloud || typeof wx.cloud.callFunction !== "function") {
      resolve(null);
      return;
    }
    wx.cloud
      .callFunction({
        name: "mascotEngine",
        data: {
          scene: "weekly_time",
          stats: stats || {},
          dataSchemaVersion: DATA_SCHEMA_VERSION,
        },
      })
      .then((resp) => {
        const r = (resp && resp.result) || {};
        if (r.success === false) {
          resolve(null);
          return;
        }
        const text = r.text && String(r.text).trim() ? r.text : null;
        resolve(text);
      })
      .catch((e) => {
        console.error("mascotEngine weekly_time", e);
        resolve(null);
      });
  });
}

function fetchMascotEngineBodyWeek(stats) {
  return new Promise((resolve) => {
    if (!wx.cloud || typeof wx.cloud.callFunction !== "function") {
      resolve(null);
      return;
    }
    wx.cloud
      .callFunction({
        name: "mascotEngine",
        data: {
          scene: "body_week",
          stats: stats || {},
          dataSchemaVersion: DATA_SCHEMA_VERSION,
        },
      })
      .then((resp) => {
        const r = (resp && resp.result) || {};
        if (r.success === false) {
          resolve(null);
          return;
        }
        const text = r.text && String(r.text).trim() ? r.text : null;
        resolve(text);
      })
      .catch((e) => {
        console.error("mascotEngine body_week", e);
        resolve(null);
      });
  });
}

module.exports = {
  DATA_SCHEMA_VERSION,
  pickBodyDailySubType,
  fetchMascotEngineBodyDaily,
  fetchMascotEngineBodyWeek,
  fetchMascotEngineWeeklyTime,
};
