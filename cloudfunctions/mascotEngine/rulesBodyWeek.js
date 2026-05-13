/**
 * 身体周报：文案与命中顺序来自本函数目录下 packages/mascot-rule-pool（与小程序包同源，见 scripts/sync-mascot-rule-pool.cjs）。
 */

const {
  resolveBodyWeekFromHits,
  RULE_PRIORITY_BODY_WEEK,
  BODY_WEEK_WEEKLY_RULE_TEXT,
} = require("./packages/mascot-rule-pool");

const RULE_PRIORITY = RULE_PRIORITY_BODY_WEEK;
const RULE_TEXT = BODY_WEEK_WEEKLY_RULE_TEXT;

module.exports = {
  resolveBodyWeekFromHits,
  RULE_PRIORITY,
  RULE_TEXT,
};
