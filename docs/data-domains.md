# 本地数据域清单（F3-1）

> 机器可读源：`miniprogram/config/localDataDomains.js`  
> 后续 Step F3-2 / I4 / F2b 均引用该文件，避免文案与行为脱节。

## 清除预设（设置页）

| 预设 ID | 用户可见名称 | 当前会清除的域 |
|---------|--------------|----------------|
| `imageCache` | 清除图片缓存 | 图片缓存 |
| `tasksReflection` | 清除任务与哲思本地记录 | 任务记录、哲思复盘作答 |

**当前不会**被 `tasksReflection` 清除、但对用户可见的域：身体边界记录、身体边界周报存档、每日打卡、个人资料、问卷标签、任务日历提醒注册表、哲思回响队列/失败记录等。部分数据可在对应页面单独修改或删除。

## 全量域表

| domain | 用户名称 | Storage 键 | 可清除预设 | 可丢弃(F2b) | 云同步 | 备注 |
|--------|----------|------------|------------|-------------|--------|------|
| tasks | 任务记录 | `sleep_tasks` | tasksReflection | 否 | push-only | 删任务不删复盘 |
| reflection | 哲思复盘作答 | `reflection_records` | tasksReflection | 否 | none | 哲思列表长按删 |
| reflection_ark_pending | 哲思回响队列 | `reflection_ark_pending_v1` | — | 是 | none | 清除任务与哲思时不删 |
| reflection_ark_failed | 回响失败记录 | `reflection_ark_gen_failed_v1` | — | 是 | none | |
| reflection_ark_cache | 哲思回响(云) | （无本地 key） | — | 否 | none | 仅内存+云 DB |
| body | 身体边界记录 | `body_records` | — | 否 | push-only | 今日报告页可改 |
| body_week_archive | 身体周报存档 | `body_week_archive_v1` | — | 否 | pull-merge | 支持云 pull |
| daily_check_in | 每日打卡 | `daily_check_ins` | — | 否 | none | |
| profile | 个人资料 | `user_profile`, `profile_customized` | — | 否 | none | 退出不清 |
| user_tags | 问卷标签 | `user_tags_complete`, `user_tags_local` | — | 否 | none | 云+本地缓存 |
| session | 登录会话 | `token`, `userInfo`, `has_logged_in`, `user_openid` | — | 否 | none | logout 清除 |
| cloud_sync_cursors | 同步游标 | `cloud_data_full_synced`, `last_sync_*` | — | 否 | none | |
| referrer | 分享归因 | `pending_referrer_*` | — | 否 | none | logout 保留 |
| task_reminder_registry | 日历提醒注册 | `task_calendar_reminder_registry` | — | 是 | none | 不能取消已写日历 |
| settings | 提醒开关 | `reminder_enabled` | — | 否 | none | |
| image_cache | 图片缓存 | `cache_images` + 前缀 key | imageCache | 是 | none | |
| ui_guide | 日历引导计数 | `calendar_notice_guide_*` | — | 是 | none | UI 状态 |
| debug | 错误快照 | `__app_last_error` | — | 是 | none | 诊断用 |

## 散落 Storage 键（未在 storageKeys.js）

| 键名 | 所属域 | 说明 |
|------|--------|------|
| `token` | session | authSession |
| `userInfo` | session | authSession |
| `task_calendar_reminder_registry` | task_reminder_registry | reminderRegistry.js |
| `reflection_ark_pending_v1` | reflection_ark_pending | reflectionArkBackground.js |
| `reflection_ark_gen_failed_v1` | reflection_ark_failed | reflectionArkBackground.js |
| `calendar_notice_guide_shown_count` | ui_guide | calendarNotifyGuide.js |
| `calendar_notice_guide_never_again` | ui_guide | calendarNotifyGuide.js |
| `__app_last_error` | debug | app.js |
| `temp_image_*` / `image_temp_*` / `draft_image_*` | image_cache | 前缀匹配 |

## 产品边界（Phase 1 不变）

1. **删任务 ≠ 删复盘** — 复盘保留，哲思列表手动删。
2. **日历提醒** — 写入系统日历后，删任务/清 registry 均不能自动取消，需用户到系统日历删除。
3. **换机** — 任务/身体/哲思作答主要在本机；任务与身体仅有 push，无 pull（周报存档除外）。
4. **资料/问卷** — 主要在本机；云 tags 未落库时换机可能重填问卷。

## TODO（不进 Phase 1）

- 哲思列表：关联任务已删时显示「已删除的任务」或灰显。
- Phase 2：云 delete + pull + 冲突副本（见同步协议设计，未编写）。

## 变更记录

| 日期 | 步骤 | 说明 |
|------|------|------|
| 2026-05-27 | F3-1 | 初版清单 |
| 2026-05-27 | F3-2 | 设置页清除逻辑迁至 localDataClear.js |
