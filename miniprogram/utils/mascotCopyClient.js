const { DATA_SCHEMA_VERSION } = require("./mascotCopyStats");
const {
  pickBodyWeekRuleKey,
  pickWeeklyTimeRuleKey,
  BODY_WEEK_WEEKLY_RULE_TEXT,
} = require("./mascotRulePool");

const BLACKLIST_RE = /得分|评分|分数|不合格|不达标/;

const RULE_TEXT = {
  ...BODY_WEEK_WEEKLY_RULE_TEXT,
  body_daily_no_checkin: "今天还没和身体打招呼。有空时，给身体留个空白也好。",
  infra_error: "小麟暂时走神了。稍等片刻，或者下拉刷新一下。",
  neutral_xiaolin: "小麟在这儿陪着你。这一周，先照顾好此刻的自己。",
  neutral_xiaoqi: "小麒在这儿。按你的节奏来，一步一步就好。",
};

function normalizeHits(hits) {
  if (!Array.isArray(hits)) return [];
  return hits.filter((h) => typeof h === "string" && h);
}

function pickRuleHit(scene, hits) {
  if (scene === "body_week") return pickBodyWeekRuleKey(hits);
  if (scene === "weekly_time") return pickWeeklyTimeRuleKey(hits);
  if (scene === "body_daily" && hits.indexOf("no_checkin") >= 0) return "body_daily_no_checkin";
  return "";
}

function buildContinuation(scene) {
  if (scene === "body_week" || scene === "weekly_time") return "";
  if (scene === "task_create") {
    return "小麒陪你从当下这一刻开始，不必急着证明什么。";
  }
  if (scene === "body_daily") {
    return "小麟在这儿，陪你慢慢听一听身体的边界。";
  }
  return "";
}

function postFilterBlacklist(text) {
  if (!text || typeof text !== "string") return false;
  return !BLACKLIST_RE.test(text);
}

function composeLocalCopy(scene, stats) {
  const hits = normalizeHits(stats && stats.hits);
  const ruleKey = pickRuleHit(scene, hits);
  const ruleText = ruleKey ? RULE_TEXT[ruleKey] || "" : "";
  const continuation = buildContinuation(scene);
  let text = ruleText && continuation ? `${ruleText}${continuation}` : ruleText || continuation;
  if (!text) {
    text = scene === "task_create" ? RULE_TEXT.neutral_xiaoqi : RULE_TEXT.neutral_xiaolin;
  }
  if (!postFilterBlacklist(text)) {
    text = scene === "task_create" ? RULE_TEXT.neutral_xiaoqi : RULE_TEXT.neutral_xiaolin;
  }
  return { text, infraError: false, degraded: true };
}

function fetchMascotCopy(scene, stats) {
  const payload = {
    type: "getMascotCopy",
    scene,
    dataSchemaVersion: DATA_SCHEMA_VERSION,
    stats,
  };

  if (!wx.cloud || typeof wx.cloud.callFunction !== "function") {
    return Promise.resolve(composeLocalCopy(scene, stats));
  }

  return wx.cloud
    .callFunction({
      name: "quickstartFunctions",
      data: payload,
    })
    .then((resp) => {
      const result = (resp && resp.result) || {};
      const text = result.text || "";
      if (result.infraError) {
        return { text: RULE_TEXT.infra_error, infraError: true, degraded: true };
      }
      if (!text || !postFilterBlacklist(text)) {
        return composeLocalCopy(scene, stats);
      }
      return { text, infraError: false, degraded: !!result.blacklistDropped };
    })
    .catch(() => composeLocalCopy(scene, stats));
}

module.exports = {
  fetchMascotCopy,
  composeLocalCopy,
  RULE_TEXT,
};
