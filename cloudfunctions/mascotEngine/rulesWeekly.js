/**
 * 时间编织周报 weekly_time：与 mascotCopy pickRuleHit(weekly_time) 同源（mascot-rule-pool）。
 */

const {
  resolveWeeklyTimeFromHits,
  RULE_PRIORITY_WEEKLY_TIME,
  BODY_WEEK_WEEKLY_RULE_TEXT,
} = require("./packages/mascot-rule-pool");

const RULE_PRIORITY = RULE_PRIORITY_WEEKLY_TIME;
const RULE_TEXT = BODY_WEEK_WEEKLY_RULE_TEXT;

module.exports = {
  resolveWeeklyTimeFromHits,
  RULE_PRIORITY,
  RULE_TEXT,
};
