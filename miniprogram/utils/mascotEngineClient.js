/**
 * 调用独立云函数 mascotEngine（与 quickstartFunctions / getMascotCopy 并存）。
 * 今日身体：scene body_daily + subType 形如 sleep_睡得香。
 */

const DATA_SCHEMA_VERSION = "1";

const BODY_DAILY_LINES = {
  sleep_睡得香: "这一觉睡得踏实，睡好了今天就有底气。",
  sleep_做梦了: "做了很多梦吧，那是大脑在帮您整理。",
  sleep_睡不实: "夜里醒了几次，没关系，起伏本身就是生命的节奏。",
  sleep_睡不着: "没睡着也别怪自己，身体知道您需要什么，今晚再试试。",
  sport_动够了: "身体被充分激活了，每一滴汗都在帮您清理疲惫。",
  sport_动了点: "动了就好，不追求多，身体要的是您的记得。",
  sport_没咋动: "今天没动也没关系，明天散个步就行。",
  sport_动过头了: "感觉到累了吧，明天缓一缓，休息也是运动的一部分。",
  signal_没事: "身体平安的信号收到了，这是今天最好的消息。",
  signal_有劲: "浑身是劲的感觉真好，记住这个状态。",
  signal_累了: "累了就歇，不扛着。身体在教您：真正的强大不是硬撑，是知道该停。",
  signal_疼了: "哪里疼，就是哪里在喊您听见它。身体从不撒谎，疼是它最后的语言。",
};

const BODY_DAILY_NEUTRAL = "今天还没和身体打招呼。有空时，给身体留个空白也好。";

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

/** 本地单句兜底（与云函数 mascotEngine rules 一致） */
function getBodyDailyMascotLine(record) {
  const subType = pickBodyDailySubType(record);
  if (subType && BODY_DAILY_LINES[subType]) {
    return BODY_DAILY_LINES[subType];
  }
  return BODY_DAILY_NEUTRAL;
}

/**
 * @param {object|null} record 当日末条身体记录；null 表示无记录（走云端中性句）
 * @returns {Promise<string|null>} 成功返回文案；失败或不可用返回 null，由页面走 getBodyDailyMascotLine 兜底
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
  getBodyDailyMascotLine,
  fetchMascotEngineBodyDaily,
  fetchMascotEngineBodyWeek,
  fetchMascotEngineWeeklyTime,
};
