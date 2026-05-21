/**
 * 云数据库 taskReply 集合字段约定（前端只读，批量导入由运维/云控制台完成）
 *
 * code       string  三位数字编码 111–444
 * fullPrefix string  固定开头文案（展示在 reply 之前）
 * reply      string  结尾陪伴文案
 * type1Name  string  优先级名称
 * type2Name  string  圈层名称
 * type3Name  string  行事层次名称
 */

const TASK_REPLY_FIELDS = [
  "code",
  "fullPrefix",
  "reply",
  "type1Name",
  "type2Name",
  "type3Name",
];

module.exports = {
  TASK_REPLY_FIELDS,
};
