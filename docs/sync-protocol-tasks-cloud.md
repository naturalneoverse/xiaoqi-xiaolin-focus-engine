# 任务云同步 API（Step 1）

云函数 `quickstartFunctions`，环境随 `DYNAMIC_CURRENT_ENV`。

## saveTask（已有，增强）

- 入参：`taskDoc` / `task`（同前）
- 写入 `clientUpdatedAt` + 兼容字段 `updatedAt`（均为客户端毫秒）
- 云侧强制：`serverUpdatedAt`（`db.serverDate()`）、`serverUpdatedAtMs`（`Date.now()`）
- 恢复软删：`status: active`，更新时 `remove` 掉 `deletedAt` / `deletedAtMs`
- 返回：`{ success, serverUpdatedAtMs? }`

## listTasks（新增）

- 入参：无（openid 来自上下文）
- 查询：`openid` + `status != deleted`（无 status 的旧文档仍会返回）
- 返回：`{ success, tasks: Task[], serverTimeMs }`

## deleteTask（新增）

- 入参：`taskId` 或 `id`
- 软删：`status: deleted`，`deletedAt` / `deletedAtMs` / `serverUpdatedAt*`
- 无文档：`success: true, skipped: true`
- 返回：`{ success, serverUpdatedAtMs? }`

## 部署

上传部署 `quickstartFunctions` 后，小程序 Step 3 方可调用 `listTasks` / `deleteTask`。
