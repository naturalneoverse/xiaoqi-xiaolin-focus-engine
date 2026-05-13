const STORAGE_KEYS = {
  REMINDER_ENABLED: "reminder_enabled",
  USER_PROFILE: "user_profile",
  HAS_LOGGED_IN: "has_logged_in",
  TASKS_DATA: "sleep_tasks",
  BODY_RECORDS: "body_records",
  CACHE_IMAGES: "cache_images",
  /** 已登录用户打卡日期 YYYY-MM-DD 列表，每日最多记一次 */
  DAILY_CHECK_INS: "daily_check_ins",
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
};

module.exports = STORAGE_KEYS;
