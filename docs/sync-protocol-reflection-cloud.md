# 哲思象限作答云 API（Step 2）

集合：`reflection_quadrants`（**多端同步作答必建**；建议索引 `openid` + `taskId` + `quadrantId`）

> `reflection_ark_cache` 仅为小麒小麟「回响」缓存，**不能**代替 `reflection_quadrants`。控制台若只有 ark_cache，电脑端列表会为空；1.3.2+ 云函数在 quadrants 为空时会用 ark_cache 拼**列表占位**，完整作答仍需手机 push 到 `reflection_quadrants`。

每条文档 = 一个用户 + 一个任务 + 一个象限（1–4）。

## saveReflectionQuadrant

入参：

| 字段 | 必填 | 说明 |
|------|------|------|
| taskId | 是 | 任务 ID |
| quadrantId | 是 | 1–4 |
| cardResponses | 是 | 作答数组 |
| completedAtMs | 是 | 象限提交毫秒 |
| completedAt | 否 | 展示时间 |
| taskTitle | 否 | 任务标题快照 |
| recordCreatedAt / recordUpdatedAt | 否 | 记录级时间，缺省用 completedAtMs |
| latestCompletedAt / latestCompletedAtMs | 否 | 列表排序用 |

写入 `serverUpdatedAt` / `serverUpdatedAtMs`；`status: active`。

## listReflectionRecords

入参：`taskId`（可选，只拉某任务）

返回：`{ success, records: ReflectionRecord[], serverTimeMs }`  
（服务端按象限文档聚合成与本地 `reflection_records` 一致的结构）

## deleteReflectionQuadrant

入参：`taskId`, `quadrantId` — 软删单象限。

## purgeReflectionTask

入参：`taskId` — 软删该任务下全部象限（最多 4 条）。

## 部署

与 Step 1 相同：上传部署 `quickstartFunctions`。可与 Step 1 一次部署。
