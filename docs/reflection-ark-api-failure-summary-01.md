# 哲思复盘 · API 失败原因总结（一）

> **备注**：`api失败原因总结一` — 记录 2026-05 前后「报告始终兜底短句 / 只成功一半」的排查结论与修复依据。  
> **关联**：联调说明见 [reflection-ark-integration.md](./reflection-ark-integration.md)；云函数 `cloudfunctions/reflectionArk/`。

---

## 1. 现象

| 表现 | 说明 |
|------|------|
| 报告里手写段 | 固定短句「用心觉察自我，安然面对日常点滴。」 |
| 有时「成功一半」 | 一张长文 + 一张短句；或中间一段很长但无「小麟说」（选择题本地回响） |
| 提交时 | 转圈较久，仍显示提交成功；结语气泡（小麟双气泡）正常 |
| 数据库 | `reflection_ark_cache` 在修复前长期为空 |

---

## 2. 结论（一句话）

**失败根本原因：云函数调用火山方舟时，在设定的 HTTP 超时内未拿到有效回复，按设计写入兜底；主因是云端长期运行旧版超时逻辑（8s 并行 / 10s 串行）且云函数总时长与代码未同步部署，而非手机、结语气泡或 API Key 未配置。**

修复后 `arkProbe` 约 1.5s 成功、真机提交成功，说明 **Key 与方舟链路正常**，此前问题在 **批量生成的超时预算与部署版本**。

---

## 3. 日志证据

### 3.1 失败 A：约 8 秒（并行每路 8s）

- `Duration: 8123ms`
- `errCode: ARK_TIMEOUT`，`httpStatus: 0`
- `generateQuadrantBatch`，c0、c2 同时超时，`fallbackCount: 2`

**解读**：旧版批量 **并行、每路 8 秒**，双双到点失败。

### 3.2 失败 B：约 20 秒（串行每路 10s，象限 2）

- `Duration: 20187ms`
- c0：约 10.1s → `ARK_TIMEOUT`；c1：再约 10.1s → `ARK_TIMEOUT`

**解读**：**串行、每卡 10 秒**；完整生成（长人设 + 正文）常需 >10s，仍全兜底。

### 3.3 成功对照：arkProbe（部署后）

```json
{"ok":true,"action":"arkProbe","errCode":"OK","durationMs":1488,"textPreview":"好"}
```

极简请求 → 证明 **ARK_API_KEY、端点、云函数出网** 正常。

### 3.4 成功对照：真机提交

- 云函数超时改为 **60s**，**上传并部署**最新 `reflectionArk`，小程序重新编译后，报告为长文专属回复。

---

## 4. 原因分层

### 4.1 主因

| 编号 | 原因 | 说明 |
|------|------|------|
| P1 | 云端代码/超时未更新 | 日志 8s、10+10s 与仓库「25s 并行 + 60s 云函数」不一致 |
| P2 | 单路 HTTP 超时 < 方舟实际耗时 | 完整 `generateReply` 远重于 `arkProbe` |
| P3 | 批量策略叠加 | 先并行 8s 双死，后串行 10s 仍不够 |

### 4.2 次因

| 编号 | 原因 | 说明 |
|------|------|------|
| S1 | 只改控制台超时未上传代码 | 仅改 60s 不会自动变成 25s 并行逻辑 |
| S2 | CLI 部署清单未列 reflectionArk | `cloudbaserc` / `wxcloud.config` 以 `getReply` 为主，易漏部署 |
| S3 | 网络/时段波动 | 次要；同环境 probe 快、长文生成慢 |

### 4.3 已排除

- 手机性能、小麟结语气泡（本地文案、在 API 之后）
- `msgSecCheck` 拦截（通常 PASS，<1s）
- 旧缓存（兜底不写库，库空因从未成功）
- 报告拼装丢字段（读 `reflection_ark_cache`，失败则用同一句兜底）

---

## 5. 兜底机制（为何总是同一句）

```
方舟失败 → fallback: true → 不 upsert reflection_ark_cache
        → 返回 FALLBACK_REPLY → 报告无缓存 → 前端 getFallbackReply 同句
```

「成功一半」：一张 `ARK_TIMEOUT`、一张成功；或选择题段为本地长文（非 AI）。

---

## 6. 已采纳修复（当前仓库）

| 项 | 值 |
|----|-----|
| `config.json` 云函数超时 | 60s |
| 双卡批量 | 并行，每路 `ARK_TIMEOUT_MS` = 25s |
| 小程序 `GENERATE_REPLY_TIMEOUT_MS` | 65s |
| 探测 | `action: "arkProbe"` |
| 兜底 | 不写入缓存；命中旧兜底缓存会跳过并重新生成 |

**部署检查**：日志/返回应含 `batchMode: "parallel"`、`arkTimeoutMs: 25000`；不应再稳定出现 10s+10s。

---

## 7. 后续建议

1. 部署后先看 `arkProbe`，再提交象限。  
2. 再兜底：区分 `ARK_TIMEOUT`（加长/网络）与 `ARK_EMPTY_OUTPUT`（响应解析）。  
3. 可在日志增加 `deployTag` 便于确认是否新包。  
4. API Key 勿提交进 Git；若曾截图泄露，建议在火山控制台轮换。

---

## 8. 修订记录

| 日期 | 说明 |
|------|------|
| 2026-05-22 | 初稿：api失败原因总结一，对应用户侧排查与修复验证 |
