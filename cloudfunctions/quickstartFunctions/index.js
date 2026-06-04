/**
 * 首次用户标签：集合名 user_tags，字段 openid / gender / lifeStage / roles / createdAt / updatedAt。
 * 请在云控制台创建集合 user_tags，并配置权限（示例）：仅创建者可读写，
 * 或使用云函数内 getWXContext().OPENID 写入，前端仅通过本云函数访问。
 */
const cloud = require("wx-server-sdk");
const mascotCopy = require("./mascotCopy");
const taskQuiz = require("./taskQuiz");
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();

const USER_TAGS_COLL = "user_tags";
const VALID_GENDER = new Set(["she", "he", "na"]);
const VALID_STAGE = new Set(["starting", "pushing", "halfway", "enjoying"]);
const VALID_ROLES = new Set([
  "cattle",
  "herder",
  "boss",
  "resting",
  "parent",
  "child",
  "partnered",
  "solo",
  "exploring",
]);

function isTagsDocComplete(doc) {
  if (!doc) return false;
  if (!VALID_GENDER.has(doc.gender)) return false;
  if (!VALID_STAGE.has(doc.lifeStage)) return false;
  if (!Array.isArray(doc.roles) || doc.roles.length < 2) return false;
  return doc.roles.every((r) => VALID_ROLES.has(r));
}

async function fetchTagsCompleteForOpenid(openid) {
  if (!openid) return false;
  try {
    const res = await db.collection(USER_TAGS_COLL).where({ openid }).limit(1).get();
    const doc = res.data && res.data[0];
    return isTagsDocComplete(doc);
  } catch (e) {
    return false;
  }
}

/** 换机后仍以云端为准：是否已填写首次标签 */
const getUserTags = async () => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  if (!openid) {
    return { success: false, errMsg: "no openid", tagsComplete: false };
  }
  try {
    const res = await db.collection(USER_TAGS_COLL).where({ openid }).limit(1).get();
    const doc = res.data && res.data[0];
    const tagsComplete = isTagsDocComplete(doc);
    const profile = tagsComplete
      ? { gender: doc.gender, lifeStage: doc.lifeStage, roles: doc.roles }
      : null;
    return { success: true, tagsComplete, profile };
  } catch (e) {
    return { success: false, errMsg: e && e.message ? e.message : String(e), tagsComplete: false };
  }
};

const saveUserTags = async (event) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  if (!openid) {
    return { success: false, errMsg: "no openid" };
  }
  const gender = event && event.gender;
  const lifeStage = event && event.lifeStage;
  const roles = event && event.roles;
  if (!VALID_GENDER.has(gender)) {
    return { success: false, errMsg: "invalid gender" };
  }
  if (!VALID_STAGE.has(lifeStage)) {
    return { success: false, errMsg: "invalid stage" };
  }
  if (!Array.isArray(roles) || roles.length < 2) {
    return { success: false, errMsg: "roles need at least 2" };
  }
  const filtered = roles.filter((r) => VALID_ROLES.has(r));
  if (filtered.length < 2) {
    return { success: false, errMsg: "invalid roles" };
  }
  const now = db.serverDate();
  const payload = {
    openid,
    gender,
    lifeStage,
    roles: filtered,
    updatedAt: now,
  };
  try {
    const existed = await db.collection(USER_TAGS_COLL).where({ openid }).limit(1).get();
    if (existed.data && existed.data[0]) {
      await db.collection(USER_TAGS_COLL).doc(existed.data[0]._id).update({ data: payload });
    } else {
      await db.collection(USER_TAGS_COLL).add({
        data: {
          ...payload,
          createdAt: now,
        },
      });
    }
    return { success: true };
  } catch (e) {
    return { success: false, errMsg: e && e.message ? e.message : String(e) };
  }
};

const TASKS_COLL = "tasks";
const TASK_STATUS_ACTIVE = "active";
const TASK_STATUS_DELETED = "deleted";
const BODY_RECORDS_COLL = "body_records";
const BODY_WEEK_ARCHIVE_COLL = "body_week_archives";
const _ = db.command;

function stripUndefinedDeep(input) {
  if (input === undefined) return undefined;
  if (input === null || typeof input !== "object") return input;
  if (Array.isArray(input)) {
    return input.map((x) => stripUndefinedDeep(x)).filter((x) => x !== undefined);
  }
  const out = {};
  Object.keys(input).forEach((k) => {
    const v = input[k];
    if (v === undefined) return;
    const nv = typeof v === "object" && v !== null ? stripUndefinedDeep(v) : v;
    if (nv !== undefined) out[k] = nv;
  });
  return out;
}

function normalizeTagsForDb(tags) {
  if (!Array.isArray(tags)) return [];
  return tags.map((t) => ({
    text: t && t.text != null ? String(t.text) : "",
    className: t && t.className != null ? String(t.className) : "",
  }));
}

/** 云函数写入时生成，客户端不得覆盖 */
function serverTimestamps() {
  const serverUpdatedAtMs = Date.now();
  return {
    serverUpdatedAt: db.serverDate(),
    serverUpdatedAtMs,
  };
}

/**
 * 将 DB 文档转为客户端任务形状（pull 用）
 * @param {object} doc
 */
function taskDocToClient(doc) {
  if (!doc || !doc.id) return null;
  const clientUpdatedAt = Number(
    doc.clientUpdatedAt != null ? doc.clientUpdatedAt : doc.updatedAt
  );
  return stripUndefinedDeep({
    id: String(doc.id),
    title: doc.title != null ? String(doc.title) : "",
    content: doc.content != null ? String(doc.content) : "",
    timeText: doc.timeText != null ? String(doc.timeText) : "",
    dateValue: doc.dateValue != null ? String(doc.dateValue) : "",
    statusText: doc.statusText != null ? String(doc.statusText) : "",
    done: !!doc.done,
    createdAt: doc.createdAt != null ? String(doc.createdAt) : "",
    updatedAt: Number.isFinite(clientUpdatedAt) ? clientUpdatedAt : 0,
    clientUpdatedAt: Number.isFinite(clientUpdatedAt) ? clientUpdatedAt : 0,
    serverUpdatedAtMs: Number(doc.serverUpdatedAtMs) || 0,
    completedAt: doc.completedAt != null ? String(doc.completedAt) : "",
    reminderDate: doc.reminderDate != null ? String(doc.reminderDate) : "",
    reminderTime: doc.reminderTime != null ? String(doc.reminderTime) : "",
    reminderFrequency: doc.reminderFrequency != null ? String(doc.reminderFrequency) : "不重复",
    tags: Array.isArray(doc.tags) ? doc.tags : [],
  });
}

/**
 * @param {object} task 客户端 taskDoc
 * @param {string} openid
 */
function buildTaskDbPayload(task, openid) {
  const clientUpdatedAt = Number(task.updatedAt);
  if (!Number.isFinite(clientUpdatedAt)) {
    return { errMsg: "invalid updatedAt" };
  }
  const titleRaw = task.title != null ? String(task.title) : "";
  const title = titleRaw.trim() || "未命名任务";
  const statusRaw = task.statusText != null ? String(task.statusText) : "";
  const statusText = statusRaw.trim() || "进行中";
  let createdAt = task.createdAt != null ? String(task.createdAt) : "";
  if (!createdAt.trim()) {
    createdAt = new Date(clientUpdatedAt).toISOString().slice(0, 16).replace("T", " ");
  }
  const tags = normalizeTagsForDb(Array.isArray(task.tags) ? task.tags : []);
  const stamps = serverTimestamps();
  const data = stripUndefinedDeep({
    openid,
    id: task.id.trim(),
    title,
    content: task.content != null ? String(task.content) : "",
    timeText: task.timeText != null ? String(task.timeText) : "",
    dateValue: task.dateValue != null ? String(task.dateValue) : "",
    statusText,
    done: !!task.done,
    createdAt,
    updatedAt: clientUpdatedAt,
    clientUpdatedAt,
    completedAt: task.completedAt != null ? String(task.completedAt) : "",
    reminderDate: task.reminderDate != null ? String(task.reminderDate) : "",
    reminderTime: task.reminderTime != null ? String(task.reminderTime) : "",
    reminderFrequency: task.reminderFrequency != null ? String(task.reminderFrequency) : "不重复",
    tags,
    status: TASK_STATUS_ACTIVE,
    ...stamps,
  });
  return { data, serverUpdatedAtMs: stamps.serverUpdatedAtMs };
}

const saveTask = async (event) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  if (!openid) {
    return { success: false, errMsg: "no openid" };
  }
  /** 优先 taskDoc：少数环境下 event.task 与运行时字段名冲突导致取不到；兼容旧入参 event.task */
  const task = (event && event.taskDoc) || (event && event.task);
  if (!task || typeof task.id !== "string" || !task.id.trim()) {
    return { success: false, errMsg: "missing task.id" };
  }
  const built = buildTaskDbPayload(task, openid);
  if (built.errMsg) {
    return { success: false, errMsg: built.errMsg };
  }
  const { data, serverUpdatedAtMs } = built;
  try {
    const existed = await db.collection(TASKS_COLL).where({ openid, id: data.id }).limit(1).get();
    if (existed.data && existed.data[0]) {
      await db.collection(TASKS_COLL).doc(existed.data[0]._id).update({
        data: {
          ...data,
          deletedAt: _.remove(),
          deletedAtMs: _.remove(),
        },
      });
    } else {
      await db.collection(TASKS_COLL).add({ data });
    }
    return { success: true, serverUpdatedAtMs };
  } catch (e) {
    return { success: false, errMsg: e && e.message ? e.message : String(e) };
  }
};

const listTasks = async () => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  if (!openid) {
    return { success: false, errMsg: "no openid", tasks: [] };
  }
  try {
    const res = await db
      .collection(TASKS_COLL)
      .where({
        openid,
        status: _.neq(TASK_STATUS_DELETED),
      })
      .limit(500)
      .get();
    const rows = (res.data || [])
      .map(taskDocToClient)
      .filter(Boolean);
    return { success: true, tasks: rows, serverTimeMs: Date.now() };
  } catch (e) {
    return { success: false, errMsg: e && e.message ? e.message : String(e), tasks: [] };
  }
};

const deleteTask = async (event) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  if (!openid) {
    return { success: false, errMsg: "no openid" };
  }
  const taskId = String((event && (event.taskId || event.id)) || "").trim();
  if (!taskId) {
    return { success: false, errMsg: "missing taskId" };
  }
  const stamps = serverTimestamps();
  try {
    const existed = await db.collection(TASKS_COLL).where({ openid, id: taskId }).limit(1).get();
    if (!existed.data || !existed.data[0]) {
      return { success: true, skipped: true, serverUpdatedAtMs: stamps.serverUpdatedAtMs };
    }
    await db.collection(TASKS_COLL).doc(existed.data[0]._id).update({
      data: {
        status: TASK_STATUS_DELETED,
        deletedAt: stamps.serverUpdatedAt,
        deletedAtMs: stamps.serverUpdatedAtMs,
        serverUpdatedAt: stamps.serverUpdatedAt,
        serverUpdatedAtMs: stamps.serverUpdatedAtMs,
      },
    });
    return { success: true, serverUpdatedAtMs: stamps.serverUpdatedAtMs };
  } catch (e) {
    return { success: false, errMsg: e && e.message ? e.message : String(e) };
  }
};

function archiveDocFromEntry(openid, entry) {
  const e = entry || {};
  const weekKey = String(e.weekKey || "").trim();
  const updatedAt = e.updatedAt ? Date.parse(String(e.updatedAt)) : Date.now();
  return stripUndefinedDeep({
    openid,
    weekKey,
    statsHash: String(e.statsHash || ""),
    status: String(e.status || "open"),
    closedAt: e.closedAt != null ? String(e.closedAt) : "",
    bullets: Array.isArray(e.bullets) ? e.bullets : [],
    statusDesc: String(e.statusDesc || ""),
    careText: String(e.careText || ""),
    source: String(e.source || ""),
    finalStatusTitle: String(e.finalStatusTitle || ""),
    extremeLine: e.extremeLine != null ? String(e.extremeLine) : "",
    validDayCount: Number(e.validDayCount) || 0,
    updatedAt: Number.isFinite(updatedAt) ? updatedAt : Date.now(),
  });
}

const saveBodyWeekArchive = async (event) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  if (!openid) {
    return { success: false, errMsg: "no openid" };
  }
  const entry = event && event.entry;
  const weekKey = entry && String(entry.weekKey || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekKey)) {
    return { success: false, errMsg: "invalid weekKey" };
  }
  const data = archiveDocFromEntry(openid, entry);
  if (!data.statsHash || !data.source || !data.finalStatusTitle) {
    return { success: false, errMsg: "invalid archive entry" };
  }
  try {
    const existed = await db
      .collection(BODY_WEEK_ARCHIVE_COLL)
      .where({ openid, weekKey: data.weekKey })
      .limit(1)
      .get();
    if (existed.data && existed.data[0]) {
      await db.collection(BODY_WEEK_ARCHIVE_COLL).doc(existed.data[0]._id).update({ data });
    } else {
      await db.collection(BODY_WEEK_ARCHIVE_COLL).add({ data });
    }
    return { success: true };
  } catch (e) {
    return { success: false, errMsg: e && e.message ? e.message : String(e) };
  }
};

const listBodyWeekArchives = async () => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  if (!openid) {
    return { success: false, errMsg: "no openid" };
  }
  try {
    const res = await db
      .collection(BODY_WEEK_ARCHIVE_COLL)
      .where({ openid })
      .orderBy("updatedAt", "desc")
      .limit(104)
      .get();
    return { success: true, entries: res.data || [] };
  } catch (e) {
    return { success: false, errMsg: e && e.message ? e.message : String(e) };
  }
};

const saveBodyRecord = async (event) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  if (!openid) {
    return { success: false, errMsg: "no openid" };
  }
  const r = event && event.record;
  if (!r || typeof r.dateKey !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(r.dateKey)) {
    return { success: false, errMsg: "invalid dateKey" };
  }
  const updatedAt = Number(r.updatedAt);
  if (!Number.isFinite(updatedAt)) {
    return { success: false, errMsg: "invalid updatedAt" };
  }
  const sleep = r.sleep != null ? String(r.sleep) : "";
  const sport = r.sport != null ? String(r.sport) : "";
  const signal = r.signal != null ? String(r.signal) : "";
  if (!sleep || !sport || !signal) {
    return { success: false, errMsg: "missing sleep/sport/signal" };
  }
  const data = stripUndefinedDeep({
    openid,
    dateKey: r.dateKey,
    sleep,
    sport,
    signal,
    updatedAt,
    id: r.id != null ? String(r.id) : "",
    createdAt: r.createdAt != null ? String(r.createdAt) : "",
  });
  try {
    const existed = await db.collection(BODY_RECORDS_COLL).where({ openid, dateKey: data.dateKey }).limit(1).get();
    if (existed.data && existed.data[0]) {
      await db.collection(BODY_RECORDS_COLL).doc(existed.data[0]._id).update({ data });
    } else {
      await db.collection(BODY_RECORDS_COLL).add({ data });
    }
    return { success: true };
  } catch (e) {
    return { success: false, errMsg: e && e.message ? e.message : String(e) };
  }
};

// 模拟后端登录：接收 code 并返回用户登录态
const loginByCode = async (event) => {
  if (!event || !event.code) {
    return {
      success: false,
      errMsg: "missing code",
    };
  }

  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  let tagsComplete = false;
  if (openid) {
    tagsComplete = await fetchTagsCompleteForOpenid(openid);
  }
  return {
    success: true,
    openid,
    appid: wxContext.APPID,
    unionid: wxContext.UNIONID,
    sessionToken: `mock_session_${Date.now()}`,
    tagsComplete,
  };
};

// 获取openid
const getOpenId = async () => {
  // 获取基础信息
  const wxContext = cloud.getWXContext();
  return {
    openid: wxContext.OPENID,
    appid: wxContext.APPID,
    unionid: wxContext.UNIONID,
  };
};

// 获取小程序二维码
const getMiniProgramCode = async () => {
  // 获取小程序二维码的buffer
  const resp = await cloud.openapi.wxacode.get({
    path: "pages/index/index",
  });
  const { buffer } = resp;
  // 将图片上传云存储空间
  const upload = await cloud.uploadFile({
    cloudPath: "code.png",
    fileContent: buffer,
  });
  return upload.fileID;
};

const REFERRAL_COLL = "referral_attributions";

function isValidPosterReferrerSceneId(s) {
  return typeof s === "string" && s.length >= 10 && s.length <= 32 && /^[a-zA-Z0-9_-]+$/.test(s);
}

function normalizeReferralSource(event) {
  const s = event && event.source;
  if (s === "friend_share") return "friend_share";
  return "poster_qr";
}

/** 海报/转朋友归因：首种渠道各记一条；写库失败不阻塞登录（success 仍 true） */
const recordReferralAttribution = async (event) => {
  const wxContext = cloud.getWXContext();
  const invitee = String(wxContext.OPENID || "");
  const referrer = String((event && event.referrerOpenid) || "").trim();
  const source = normalizeReferralSource(event);
  if (!invitee) {
    return { success: false, errMsg: "no openid" };
  }
  if (!isValidPosterReferrerSceneId(referrer) || referrer === invitee) {
    return { success: true, skipped: true };
  }
  try {
    const existed = await db
      .collection(REFERRAL_COLL)
      .where({ inviteeOpenid: invitee, source })
      .limit(1)
      .get();
    if (existed.data && existed.data.length) {
      return { success: true, deduped: true };
    }
    await db.collection(REFERRAL_COLL).add({
      data: {
        referrerOpenid: referrer,
        inviteeOpenid: invitee,
        source,
        createdAt: db.serverDate(),
      },
    });
    return { success: true };
  } catch (e) {
    console.warn("[recordReferralAttribution]", e && e.message ? e.message : e);
    return { success: true, softFail: true, errMsg: e && e.message ? e.message : String(e) };
  }
};

/** 海报用太阳码：scene 为分享者 OPENID（≤32）；落地页为登录页；env_version 由客户端按运行版本传入 */
const getUnlimitedPosterQr = async (event) => {
  const wxContext = cloud.getWXContext();
  const openid = String(wxContext.OPENID || "");
  if (!openid) {
    return { success: false, errMsg: "no openid" };
  }
  const scene = openid.length <= 32 ? openid : openid.slice(0, 32);
  const lineColor = (event && event.lineColor) || { r: "24", g: "64", b: "97" };
  const r = String(lineColor.r);
  const g = String(lineColor.g);
  const b = String(lineColor.b);
  const allowedEnv = new Set(["develop", "trial", "release"]);
  const envVersion = allowedEnv.has(event && event.envVersion) ? event.envVersion : "release";
  const check_path = !!(event && event.checkPath);
  try {
    const resp = await cloud.openapi.wxacode.getUnlimited({
      scene,
      page: "pages/login/index",
      width: 640,
      check_path,
      env_version: envVersion,
      line_color: { r, g, b },
    });
    if (resp && resp.errCode !== undefined && resp.errCode !== 0) {
      return { success: false, errMsg: resp.errMsg || "wxacode.getUnlimited" };
    }
    if (!resp || !resp.buffer) {
      return { success: false, errMsg: "empty buffer" };
    }
    const cloudPath = `poster_qr/${Date.now()}_${Math.random().toString(36).slice(2, 10)}.png`;
    const upload = await cloud.uploadFile({
      cloudPath,
      fileContent: resp.buffer,
    });
    return { success: true, fileID: upload.fileID };
  } catch (e) {
    return { success: false, errMsg: e && e.message ? e.message : String(e) };
  }
};

/** 云存储 fileID → 临时 HTTPS，解决「仅创建者可读写」时客户端 wx.cloud.downloadFile(fileID) 失败 */
const getPosterBgUrl = async (event) => {
  const fileID = event && (event.fileID || event.fileId);
  if (!fileID || typeof fileID !== "string") {
    return { success: false, errMsg: "missing fileID" };
  }
  try {
    const r = await cloud.getTempFileURL({
      fileList: [fileID],
    });
    const item = r.fileList && r.fileList[0];
    const url = item && item.tempFileURL;
    if (!url) {
      return {
        success: false,
        errMsg: (item && item.errMsg) || "no tempFileURL",
      };
    }
    return { success: true, tempFileURL: url, maxAge: item.maxAge };
  } catch (e) {
    return { success: false, errMsg: e && e.message ? e.message : String(e) };
  }
};

// 创建集合
const createCollection = async () => {
  try {
    // 创建集合
    await db.createCollection("sales");
    await db.collection("sales").add({
      // data 字段表示需新增的 JSON 数据
      data: {
        region: "华东",
        city: "上海",
        sales: 11,
      },
    });
    await db.collection("sales").add({
      // data 字段表示需新增的 JSON 数据
      data: {
        region: "华东",
        city: "南京",
        sales: 11,
      },
    });
    await db.collection("sales").add({
      // data 字段表示需新增的 JSON 数据
      data: {
        region: "华南",
        city: "广州",
        sales: 22,
      },
    });
    await db.collection("sales").add({
      // data 字段表示需新增的 JSON 数据
      data: {
        region: "华南",
        city: "深圳",
        sales: 22,
      },
    });
    return {
      success: true,
    };
  } catch (e) {
    // 这里catch到的是该collection已经存在，从业务逻辑上来说是运行成功的，所以catch返回success给前端，避免工具在前端抛出异常
    return {
      success: true,
      data: "create collection success",
    };
  }
};

// 查询数据
const selectRecord = async () => {
  // 返回数据库查询结果
  return await db.collection("sales").get();
};

// 更新数据
const updateRecord = async (event) => {
  try {
    // 遍历修改数据库信息
    for (let i = 0; i < event.data.length; i++) {
      await db
        .collection("sales")
        .where({
          _id: event.data[i]._id,
        })
        .update({
          data: {
            sales: event.data[i].sales,
          },
        });
    }
    return {
      success: true,
      data: event.data,
    };
  } catch (e) {
    return {
      success: false,
      errMsg: e,
    };
  }
};

// 新增数据
const insertRecord = async (event) => {
  try {
    const insertRecord = event.data;
    // 插入数据
    await db.collection("sales").add({
      data: {
        region: insertRecord.region,
        city: insertRecord.city,
        sales: Number(insertRecord.sales),
      },
    });
    return {
      success: true,
      data: event.data,
    };
  } catch (e) {
    return {
      success: false,
      errMsg: e,
    };
  }
};

// 删除数据
const deleteRecord = async (event) => {
  try {
    await db
      .collection("sales")
      .where({
        _id: event.data._id,
      })
      .remove();
    return {
      success: true,
    };
  } catch (e) {
    return {
      success: false,
      errMsg: e,
    };
  }
};

// const getOpenId = require('./getOpenId/index');
// const getMiniProgramCode = require('./getMiniProgramCode/index');
// const createCollection = require('./createCollection/index');
// const selectRecord = require('./selectRecord/index');
// const updateRecord = require('./updateRecord/index');
// const fetchGoodsList = require('./fetchGoodsList/index');
// const genMpQrcode = require('./genMpQrcode/index');
// 云函数入口函数
exports.main = async (event, context) => {
  const t = event && event.type;
  switch (t) {
    case "loginByCode":
      return await loginByCode(event);
    case "getUserTags":
      return await getUserTags();
    case "saveUserTags":
      return await saveUserTags(event);
    case "getOpenId":
      return await getOpenId();
    case "getMiniProgramCode":
      return await getMiniProgramCode();
    case "getUnlimitedPosterQr":
      return await getUnlimitedPosterQr(event);
    case "recordReferralAttribution":
      return await recordReferralAttribution(event);
    case "createCollection":
      return await createCollection();
    case "selectRecord":
      return await selectRecord();
    case "updateRecord":
      return await updateRecord(event);
    case "insertRecord":
      return await insertRecord(event);
    case "deleteRecord":
      return await deleteRecord(event);
    case "getPosterBgUrl":
      return await getPosterBgUrl(event);
    case "saveTask":
      return await saveTask(event);
    case "listTasks":
      return await listTasks();
    case "deleteTask":
      return await deleteTask(event);
    case "saveBodyRecord":
      return await saveBodyRecord(event);
    case "saveBodyWeekArchive":
      return await saveBodyWeekArchive(event);
    case "listBodyWeekArchives":
      return await listBodyWeekArchives();
    case "getMascotCopy":
      return await mascotCopy.generateMascotCopy(event, cloud.getWXContext());
    case "getTaskQuizCopy":
      return await taskQuiz.getTaskQuizCopy(event);
    case "getTaskQuizInsight":
      return await taskQuiz.getTaskQuizInsight(event);
    default:
      return {
        success: false,
        errMsg: t ? `unknown cloud function type: ${String(t)}` : "missing event.type",
      };
  }
};
