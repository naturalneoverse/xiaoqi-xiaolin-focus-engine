/**
 * 云数据库 timeWeaveCopy 集合字段约定（与 taskReply 同为「逐条 JSON 导入」）
 *
 * copyKey    string  oneSelf | depthSlow | depthFast | connection | roleDuty | calmBusy | calmEasy
 * lineIndex  number  1–6，同周同 copyKey 稳定取同一句
 * text       string  正文（句末句号；称谓统一「您」；字数见 timeWeaveCopyLimits.js）
 *
 * 正文单条字数（含句号、含逗号）：
 *   oneSelf 18 | depthSlow 20 | depthFast 20 | connection 18
 *   roleDuty 20 | calmBusy 18 | calmEasy 18
 *
 * 导入示例（云开发控制台 → 数据库 → timeWeaveCopy → 导入）：
 * [
 *   { "copyKey": "oneSelf", "lineIndex": 1, "text": "行事多顺着内心所向，少有勉强与纠结。" }
 * ]
 */

const { BODY_CHAR_LENGTH_BY_KEY } = require("./timeWeaveCopyLimits");

const TIME_WEAVE_COPY_FIELDS = ["copyKey", "lineIndex", "text"];

module.exports = {
  TIME_WEAVE_COPY_FIELDS,
  BODY_CHAR_LENGTH_BY_KEY,
};
