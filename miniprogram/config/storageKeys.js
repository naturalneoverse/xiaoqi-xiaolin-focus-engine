const STORAGE_KEYS = {
  REMINDER_ENABLED: "reminder_enabled",
  USER_PROFILE: "user_profile",
  /** 用户曾在「我的」主动改过资料（launch 合并时以 user_profile 为准） */
  PROFILE_CUSTOMIZED: "profile_customized",
  HAS_LOGGED_IN: "has_logged_in",
  TASKS_DATA: "sleep_tasks",
  BODY_RECORDS: "body_records",
  CACHE_IMAGES: "cache_images",
  /** 已登录用户打卡日期 YYYY-MM-DD 列表；禁止业务代码直写，统一走 utils/dailyCheckIn.js */
  DAILY_CHECK_INS: "daily_check_ins",
  /** 打卡日期本地备份（主键异常缩水时恢复累计天数） */
  DAILY_CHECK_INS_BACKUP: "daily_check_ins_backup",
  /** 首次标签已提交（与云端同步，仅作本地缓存；换机以云为准） */
  USER_TAGS_COMPLETE: "user_tags_complete",
  /** 云未就绪时本机暂存的标签 JSON：{ gender, lifeStage, roles, savedAt }，部署云后可再上传 */
  USER_TAGS_LOCAL: "user_tags_local",
  /** 本地历史任务/身体记录是否已全量同步到云（成功后方可增量） */
  CLOUD_FULL_SYNCED: "cloud_data_full_synced",
  /** 任务增量游标：上次成功同步批次内 updatedAt（或回退 createdAt）的最大毫秒时间戳 */
  LAST_SYNC_TASK_AT: "last_sync_task_at",
  /** 身体记录增量游标，语义同 LAST_SYNC_TASK_AT */
  LAST_SYNC_BODY_AT: "last_sync_body_at",
  /** 海报扫码：待上报的分享者 openid（scene 解码后写入，登录成功后上报云端并清除） */
  PENDING_REFERRER_OPENID: "pending_referrer_openid",
  PENDING_REFERRER_TS: "pending_referrer_ts",
  /** 待上报归因来源：poster_qr | friend_share */
  PENDING_REFERRER_SOURCE: "pending_referrer_source",
  /** 当前用户 openid（登录后写入，用于「转朋友」path 带 shareUid） */
  USER_OPENID: "user_openid",
  /** 哲思复盘记录：ReflectionRecord[]，按 taskId 聚合四象限 */
  REFLECTION_RECORDS: "reflection_records",
  /** 身体边界周报周存档 { version, weeks: { [weekMondayKey]: ArchiveEntry } } */
  BODY_WEEK_ARCHIVE_V1: "body_week_archive_v1",
  /** 同步基准：任务/哲思象限 hash + serverUpdatedAtMs */
  SYNC_BASE_V1: "sync_base_v1",
  /** 待用户选择的同步冲突队列 */
  SYNC_CONFLICTS_V1: "sync_conflicts_v1",
  /** 本机已删且应阻止再 push 的任务 id → deletedAtMs */
  SYNC_TASK_TOMBSTONES_V1: "sync_task_tombstones_v1",
  /** 真我时刻轨迹页：首次说明蒙层已展示 */
  MOMENT_TRAIL_INTRO_SEEN: "moment_trail_intro_seen",
  /** 品牌引导页（小麒小麟三幕）已完整观看 */
  BRAND_INTRO_SEEN: "brand_intro_seen",
  /** 时间首页：新建真我向任务守护弹窗：上次展示或操作时间戳（24h 频控） */
  TASK_GUARDIAN_PROMPT_LAST_AT: "task_guardian_prompt_last_at",
  /** 时间首页：父任务子任务树展开状态 { [parentTaskId]: true } */
  SUBTASK_TREE_EXPANDED: "subtask_tree_expanded_v1",
};

module.exports = STORAGE_KEYS;
