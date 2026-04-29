## 全局稳定展示规则

### 1. 数据加载与渲染
- 页面 data 初始化必须提供默认值：字符串 `''`、数组 `[]`、对象 `{}`、数字 `0`、布尔 `false`。
- storage 读取必须兜底：`const xxx = wx.getStorageSync(KEY) || defaultValue`。
- 禁止在 wxml 直接访问深层嵌套属性，先在 js 中展开为可安全渲染字段。
- 列表渲染必须使用唯一 `wx:key`，禁止使用 `index`。
- 频繁切换区域优先 `hidden`，低频区域优先 `wx:if`。

### 2. 页面路由与生命周期
- 页面栈超过 10 层时改用 `wx.redirectTo`，并在代码注释说明原因。
- tabBar 页面数据刷新放 `onShow`，`onLoad` 仅做一次性初始化。
- 非 tabBar 页面在 `onUnload` 清理定时器、动画实例、事件监听。
- 复杂对象传参使用 `eventChannel` 或 `globalData`，不拼接 JSON 到 URL。
- 自定义返回按钮必须判断栈长度：有栈 `navigateBack`，无栈 `switchTab`。

### 3. 表单与输入
- 所有 `input/textarea` 必须设置 `maxlength`，按业务上限限制。
- `textarea` 必须设置 `auto-height` 或固定高度。
- 底部输入场景需处理键盘遮挡（`adjust-position` 或滚动上移）。
- 提交按钮防重复：点击后置 `submitting=true`，按钮禁用，完成后恢复。
- 表单提交前必须做前端校验（必填、格式、长度）。

### 4. 图片、字体与性能
- `image` 必须设置 `mode` 与明确宽高，必要时处理 `binderror`。
- 头像加载失败显示默认占位。
- 页面图片超过 5 张时，非首屏图片启用 `lazy-load`。
- 避免复杂 `box-shadow/backdrop-filter`，照顾低端机性能。
- 自定义字体体积过大时优先系统字体或位图替代。

### 5. 全局状态管理
- 跨页面共享数据统一放在 `app.globalData`：`userProfile`、`settings`、`hasLoggedIn`。
- 页面在 `onShow` 读取全局状态，确保数据为最新。
- 修改全局状态后依赖页面通过 `onShow` 自刷新，不做逐页手动通知。
- `setData` 仅传变化字段，单次数据量控制在 64KB 内。
- 高频更新场景节流 200ms 以上；定时任务在 `onHide` 暂停、`onShow` 恢复。

### 6. 异常与容错
- 异步函数必须 `try-catch`。
- `catch` 内输出 `console.error`，并给用户简短提示，不暴露技术细节。
- 生命周期中的异步逻辑也要在内部捕获异常。
- 微信 API 关键失败使用 `wx.showModal`，需用户明确确认。
- 新功能应提供全局开关，便于紧急关闭。

### 7. 缓存与清除逻辑
- 缓存分层：
  - A 层（不可清除）：`hasLoggedIn`、`userProfile`、任务数据。
  - B 层（可清除）：图片缓存、临时表单草稿。
  - C 层（重置型）：首次登录协议状态。
- 设置页“清除缓存”只清 B 层，且二次确认。
- 清除成功后提示“缓存已清除”。
- “清除全部数据/重置应用”需独立入口、红字警告、双重确认。
- 所有 storage key 必须统一管理在 `miniprogram/config/storageKeys.js`。
- storage 写入失败时先清理 B 层旧数据后重试一次。

### 8. 样式与尺寸复用
- 新代码先复用现有页面的颜色、字号、圆角、间距设计令牌。
- 不随意引入新的尺寸体系。
- 若样式不一致，以 `pages/` 中高频出现的值为准。
- 尺寸单位统一使用 `rpx`（宽高、间距、圆角、字号、边框等），禁止新增 `vw/vh/%` 作为主尺寸单位。
- 仅以下场景允许 `px`：系统 API 返回的原始像素值（如 safe-area / 状态栏高度）和 1px 发丝线兼容处理。

### 9. 兼容性检查
- 发版前检查：iPhone 刘海屏 safe-area、iPad 宽屏、安卓/iOS 输入与滚动差异。
- 低版本基础库 API 使用前先做能力检测。
- safe-area 统一使用 `env(safe-area-inset-top/bottom)` 体系或项目统一封装。
