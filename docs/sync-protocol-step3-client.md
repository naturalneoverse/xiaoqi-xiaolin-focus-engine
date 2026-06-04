# Step 3：小程序拉取任务与身体

## 行为

1. **启动/登录**：`pullAndMergeFromCloud` → `runFullSyncIfNeeded` → `runIncrementalSync` → 周报 pull  
2. **合并规则**：`serverUpdatedAtMs` 新者胜（无冲突弹窗，Step5 补）  
3. **删任务**：本地删 + 异步 `deleteTask` 云软删  

## 云函数（需重新部署 quickstartFunctions）

- Step1：`listTasks` / `deleteTask`  
- Step3 新增：`listBodyRecords`；`saveBodyRecord` 增加 `serverUpdatedAtMs`  

## 验收

手机有任务 → PC/新设备登录 → 时间页可见任务；删手机任务 → 云控制台 tasks 为 deleted。
