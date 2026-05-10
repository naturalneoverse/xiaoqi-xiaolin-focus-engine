/**
 * 首次用户标签：集合名 user_tags，字段 openid / gender / lifeStage / roles / createdAt / updatedAt。
 * 请在云控制台创建集合 user_tags，并配置权限（示例）：仅创建者可读写，
 * 或使用云函数内 getWXContext().OPENID 写入，前端仅通过本云函数访问。
 */
const cloud = require("wx-server-sdk");
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

/** 海报用太阳码：scene 取 OPENID 前 8 位（≤32）；line_color 对齐海报 accent */
const getUnlimitedPosterQr = async (event) => {
  const wxContext = cloud.getWXContext();
  const openid = String(wxContext.OPENID || "");
  const pad = "________";
  const scene = (openid + pad).slice(0, 8);
  const lineColor = (event && event.lineColor) || { r: "24", g: "64", b: "97" };
  const r = String(lineColor.r);
  const g = String(lineColor.g);
  const b = String(lineColor.b);
  try {
    const resp = await cloud.openapi.wxacode.getUnlimited({
      scene,
      page: "pages/sleep/index",
      width: 640,
      check_path: false,
      env_version: "release",
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
    default:
      return {
        success: false,
        errMsg: t ? `unknown cloud function type: ${String(t)}` : "missing event.type",
      };
  }
};
