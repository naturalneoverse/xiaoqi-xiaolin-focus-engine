/**
 * 本地业务数据域清单（F3-1）。
 * 供设置页「清除数据」文案生成（F3-2）、帮助页（I4）、Storage 降级（F2b）引用。
 * 本文件仅描述元数据，不在 Step 1 实现 clearMethod。
 */
const STORAGE_KEYS = require("./storageKeys");

/** 未纳入 storageKeys.js 的散落 Storage 键 */
const SCATTERED_STORAGE_KEYS = {
  AUTH_TOKEN: "token",
  AUTH_USER_INFO: "userInfo",
  TASK_REMINDER_REGISTRY: "task_calendar_reminder_registry",
  REFLECTION_ARK_PENDING: "reflection_ark_pending_v1",
  REFLECTION_ARK_GEN_FAILED: "reflection_ark_gen_failed_v1",
  CALENDAR_NOTICE_GUIDE_COUNT: "calendar_notice_guide_shown_count",
  CALENDAR_NOTICE_GUIDE_NEVER: "calendar_notice_guide_never_again",
  APP_LAST_ERROR: "__app_last_error",
};

/** 图片缓存清除时额外匹配的 key 前缀（见 settings confirmClearImageCache） */
const IMAGE_CACHE_KEY_PREFIXES = ["temp_image_", "image_temp_", "draft_image_"];

/**
 * 设置页「清除数据」预设 ID（F3-2 实现时遍历注册表）
 * @readonly
 */
const CLEAR_PRESET_IDS = {
  IMAGE_CACHE: "imageCache",
  TASKS_REFLECTION: "tasksReflection",
};

/**
 * @typedef {'none'|'push-only'|'pull-merge'} CloudSyncKind
 * @typedef {'imageCache'|'tasksReflection'} ClearPresetId
 *
 * @typedef {object} LocalDataDomain
 * @property {string} domain
 * @property {string} label
 * @property {string[]} storageKeys
 * @property {string[]} [keyPrefixes] 前缀匹配（如图片临时 key）
 * @property {boolean} clearable 是否可被设置页某预设清除
 * @property {ClearPresetId[]} clearPresets 包含该域的清除预设
 * @property {boolean} discardable F2b 写入失败时是否可优先清理
 * @property {CloudSyncKind} cloudSync
 * @property {string} notes 实现/产品备注
 * @property {string} [manualDeleteHint] 用户可在其它入口单独删除的说明
 * @property {boolean} [clearedOnLogout] 真退出时是否清除
 */

/** @type {LocalDataDomain[]} */
const LOCAL_DATA_DOMAINS = [
  {
    domain: "tasks",
    label: "任务记录",
    storageKeys: [STORAGE_KEYS.TASKS_DATA],
    clearable: true,
    clearPresets: [CLEAR_PRESET_IDS.TASKS_REFLECTION],
    discardable: false,
    cloudSync: "push-only",
    notes: "本地主存储；cloudDataSync 仅 push（saveTask），无 pull/delete。删任务不删哲思复盘（产品设定）。",
    manualDeleteHint: "可在「时间」页长按删除单条任务",
  },
  {
    domain: "reflection",
    label: "哲思复盘作答",
    storageKeys: [STORAGE_KEYS.REFLECTION_RECORDS],
    clearable: true,
    clearPresets: [CLEAR_PRESET_IDS.TASKS_REFLECTION],
    discardable: false,
    cloudSync: "none",
    notes: "按 taskId 聚合四象限；与任务生命周期解耦。用户可在哲思列表长按手动删除。",
    manualDeleteHint: "可在「哲思」列表长按删除单条复盘",
  },
  {
    domain: "reflection_ark_pending",
    label: "哲思回响生成队列",
    storageKeys: [SCATTERED_STORAGE_KEYS.REFLECTION_ARK_PENDING],
    clearable: false,
    clearPresets: [],
    discardable: true,
    cloudSync: "none",
    notes: "后台生成 pending；purgeRecordByTaskId 会清对应 task。设置「清除任务与哲思」当前不清此项。",
  },
  {
    domain: "reflection_ark_failed",
    label: "哲思回响生成失败记录",
    storageKeys: [SCATTERED_STORAGE_KEYS.REFLECTION_ARK_GEN_FAILED],
    clearable: false,
    clearPresets: [],
    discardable: true,
    cloudSync: "none",
    notes: "生成失败标记；可丢弃后由用户重新保存象限触发。",
  },
  {
    domain: "reflection_ark_cache",
    label: "哲思回响内容（云端）",
    storageKeys: [],
    clearable: false,
    clearPresets: [],
    discardable: false,
    cloudSync: "none",
    notes: "小程序端不写 Storage；reflectionArkCache 仅内存 + 云 DB reflection_ark_cache。换机需重新生成或读云。",
  },
  {
    domain: "body",
    label: "身体边界记录",
    storageKeys: [STORAGE_KEYS.BODY_RECORDS],
    clearable: false,
    clearPresets: [],
    discardable: false,
    cloudSync: "push-only",
    notes: "按 dateKey 一天一条；cloudDataSync push，无 pull。",
    manualDeleteHint: "可在「今日身体报告」等页面修改/覆盖当日记录",
  },
  {
    domain: "body_week_archive",
    label: "身体边界周报存档",
    storageKeys: [STORAGE_KEYS.BODY_WEEK_ARCHIVE_V1],
    clearable: false,
    clearPresets: [],
    discardable: false,
    cloudSync: "pull-merge",
    notes: "bodyWeekArchiveCloud 支持 push + pull 合并；相对完整的云同步域。",
  },
  {
    domain: "daily_check_in",
    label: "每日打卡记录",
    storageKeys: [STORAGE_KEYS.DAILY_CHECK_INS],
    clearable: false,
    clearPresets: [],
    discardable: false,
    cloudSync: "none",
    notes: "登录用户每日最多记一次；仅本地。",
  },
  {
    domain: "profile",
    label: "个人资料",
    storageKeys: [STORAGE_KEYS.USER_PROFILE, STORAGE_KEYS.PROFILE_CUSTOMIZED],
    clearable: false,
    clearPresets: [],
    discardable: false,
    cloudSync: "none",
    notes: "头像 fileID 在云存储；文字资料主要在本机。真退出不清 profile。",
    manualDeleteHint: "可在「我的」资料页修改",
  },
  {
    domain: "user_tags",
    label: "问卷标签",
    storageKeys: [STORAGE_KEYS.USER_TAGS_COMPLETE, STORAGE_KEYS.USER_TAGS_LOCAL],
    clearable: false,
    clearPresets: [],
    discardable: false,
    cloudSync: "none",
    notes: "云 getUserTags/saveUserTags + 本地缓存；换机以云为准（若云未落库则丢）。会话清理不清 COMPLETE（A-D）。",
  },
  {
    domain: "session",
    label: "登录会话",
    storageKeys: [
      SCATTERED_STORAGE_KEYS.AUTH_TOKEN,
      SCATTERED_STORAGE_KEYS.AUTH_USER_INFO,
      STORAGE_KEYS.HAS_LOGGED_IN,
      STORAGE_KEYS.USER_OPENID,
    ],
    clearable: false,
    clearPresets: [],
    discardable: false,
    cloudSync: "none",
    clearedOnLogout: true,
    notes: "authSession.logout 清除 token/userInfo/has_logged_in/user_openid；不清资料与 pending_referrer。",
  },
  {
    domain: "cloud_sync_cursors",
    label: "云端同步游标",
    storageKeys: [
      STORAGE_KEYS.CLOUD_FULL_SYNCED,
      STORAGE_KEYS.LAST_SYNC_TASK_AT,
      STORAGE_KEYS.LAST_SYNC_BODY_AT,
    ],
    clearable: false,
    clearPresets: [],
    discardable: false,
    cloudSync: "none",
    notes: "任务/身体 push 增量状态；清除任务本地数据不会重置游标。",
  },
  {
    domain: "referrer",
    label: "分享归因待上报",
    storageKeys: [
      STORAGE_KEYS.PENDING_REFERRER_OPENID,
      STORAGE_KEYS.PENDING_REFERRER_TS,
      STORAGE_KEYS.PENDING_REFERRER_SOURCE,
    ],
    clearable: false,
    clearPresets: [],
    discardable: false,
    cloudSync: "none",
    notes: "登录成功后上报并清除；logout 保留（C）。非用户业务内容。",
  },
  {
    domain: "task_reminder_registry",
    label: "任务日历提醒注册表",
    storageKeys: [SCATTERED_STORAGE_KEYS.TASK_REMINDER_REGISTRY],
    clearable: false,
    clearPresets: [],
    discardable: true,
    cloudSync: "none",
    notes: "幂等记录已写入系统日历的参数；删 registry 不能取消已写入日历的事件（微信无删日历 API）。F1′ 可选删 taskId 条目。",
  },
  {
    domain: "settings",
    label: "提醒开关偏好",
    storageKeys: [STORAGE_KEYS.REMINDER_ENABLED],
    clearable: false,
    clearPresets: [],
    discardable: false,
    cloudSync: "none",
    notes: "全局 reminderEnabled；我的页与设置页均可改。",
  },
  {
    domain: "image_cache",
    label: "图片缓存",
    storageKeys: [STORAGE_KEYS.CACHE_IMAGES],
    keyPrefixes: IMAGE_CACHE_KEY_PREFIXES,
    clearable: true,
    clearPresets: [CLEAR_PRESET_IDS.IMAGE_CACHE],
    discardable: true,
    cloudSync: "none",
    notes: "设置「清除图片缓存」；含 temp_image_ / image_temp_ / draft_image_ 前缀 key。",
  },
  {
    domain: "ui_guide",
    label: "日历通知引导计数",
    storageKeys: [
      SCATTERED_STORAGE_KEYS.CALENDAR_NOTICE_GUIDE_COUNT,
      SCATTERED_STORAGE_KEYS.CALENDAR_NOTICE_GUIDE_NEVER,
    ],
    clearable: false,
    clearPresets: [],
    discardable: true,
    cloudSync: "none",
    notes: "UI 提示状态，非用户业务数据。",
  },
  {
    domain: "debug",
    label: "应用错误快照",
    storageKeys: [SCATTERED_STORAGE_KEYS.APP_LAST_ERROR],
    clearable: false,
    clearPresets: [],
    discardable: true,
    cloudSync: "none",
    notes: "app.js 诊断用，可安全丢弃。",
  },
];

/**
 * @param {ClearPresetId|string} presetId
 * @returns {LocalDataDomain[]}
 */
function getDomainsByClearPreset(presetId) {
  const id = String(presetId || "").trim();
  return LOCAL_DATA_DOMAINS.filter(
    (d) => d.clearable && Array.isArray(d.clearPresets) && d.clearPresets.includes(id)
  );
}

/**
 * 某清除预设不会动到的、且对用户有意义的业务域（用于确认弹窗「不会清除」列表）
 * @param {ClearPresetId|string} presetId
 * @returns {LocalDataDomain[]}
 */
function getUserFacingDomainsExcludedFromPreset(presetId) {
  const id = String(presetId || "").trim();
  const skip = new Set(["debug", "ui_guide", "referrer", "session", "cloud_sync_cursors", "reflection_ark_cache"]);
  return LOCAL_DATA_DOMAINS.filter((d) => {
    if (skip.has(d.domain)) return false;
    if (d.clearable && d.clearPresets.includes(id)) return false;
    return true;
  });
}

/**
 * F2b：写入失败时可尝试清理的域（按 discardable 标记）
 * @returns {LocalDataDomain[]}
 */
function getDiscardableDomains() {
  return LOCAL_DATA_DOMAINS.filter((d) => d.discardable);
}

/**
 * @param {ClearPresetId|string} presetId
 * @returns {string[]}
 */
function getClearPresetIncludedLabels(presetId) {
  return getDomainsByClearPreset(presetId).map((d) => d.label);
}

/**
 * @param {ClearPresetId|string} presetId
 * @returns {string[]}
 */
function getClearPresetExcludedLabels(presetId) {
  return getUserFacingDomainsExcludedFromPreset(presetId).map((d) => d.label);
}

module.exports = {
  SCATTERED_STORAGE_KEYS,
  IMAGE_CACHE_KEY_PREFIXES,
  CLEAR_PRESET_IDS,
  LOCAL_DATA_DOMAINS,
  getDomainsByClearPreset,
  getUserFacingDomainsExcludedFromPreset,
  getDiscardableDomains,
  getClearPresetIncludedLabels,
  getClearPresetExcludedLabels,
};
