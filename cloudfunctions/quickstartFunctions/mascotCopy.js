const crypto = require("crypto");
const {
  pickBodyWeekRuleKey,
  pickWeeklyTimeRuleKey,
  BODY_WEEK_WEEKLY_RULE_TEXT,
} = require("./packages/mascot-rule-pool");

const DATA_SCHEMA_VERSION = "1";
const PROMPT_TEMPLATE_VERSION = "1";
const MODEL_ID = "rule-v1";

const BLACKLIST_RE = /得分|评分|分数|不合格|不达标/;

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map();

const SCENE_ALLOWED_STATS = {
  weekly_time: new Set([
    "weekKey",
    "hasTimeLogs",
    "momentCount",
    "completionRate",
    "completionRateWoW",
    "avgDelayHours",
    "mostDelayedTag",
    "coreGoalTags",
    "deepWorkShare",
    "delayTagShare",
    "insufficientSample",
    "hits",
  ]),
  body_week: new Set([
    "weekKey",
    "validDayCount",
    "sleep",
    "sport",
    "signal",
    "multiNegativeTrends",
    "sleepPersistentlyPoor",
    "hits",
  ]),
  body_daily: new Set(["dateKey", "hasCheckin", "hits"]),
  task_create: new Set(["weekday", "slot", "preferenceTags", "taskCategory", "hits"]),
};

const RULE_TEXT = {
  ...BODY_WEEK_WEEKLY_RULE_TEXT,
  body_daily_no_checkin: "今天还没和身体打招呼。有空时，给身体留个空白也好。",
  infra_error: "小麟暂时走神了。稍等片刻，或者下拉刷新一下。",
  neutral_xiaolin: "小麟在这儿陪着您。这一周，先照顾好此刻的自己。",
  neutral_xiaoqi: "小麒在这儿。按您的节奏来，一步一步就好。",
};

function hashOpenIdPrefix(openid) {
  if (!openid) return "anon";
  return crypto.createHash("sha256").update(String(openid)).digest("hex").slice(0, 12);
}

function pickAllowedStats(scene, stats) {
  const allowed = SCENE_ALLOWED_STATS[scene];
  if (!allowed || !stats || typeof stats !== "object") return {};
  const out = {};
  allowed.forEach((key) => {
    if (stats[key] !== undefined) out[key] = stats[key];
  });
  return out;
}

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

function buildNarrative(scene, stats) {
  if (scene === "body_week") {
    const parts = [];
    const sleep = stats.sleep || {};
    const sport = stats.sport || {};
    const signal = stats.signal || {};
    if (sleep.trend_description) parts.push(`睡眠：${sleep.trend_description}`);
    if (sleep.fluctuation_level) parts.push(`睡眠波动水平为${sleep.fluctuation_level}`);
    if (sport.trend_description) parts.push(`运动：${sport.trend_description}`);
    if (signal.trend_description) parts.push(`身体信号：${signal.trend_description}`);
    return parts.join("；");
  }
  if (scene === "weekly_time") {
    const parts = [];
    if (stats.completionRateWoW != null) {
      const pct = Math.round(Math.abs(stats.completionRateWoW) * 100);
      const dir = stats.completionRateWoW >= 0 ? "上升" : "下降";
      parts.push(`完成率较上周约${dir}${pct}%`);
    }
    if (stats.mostDelayedTag) parts.push(`延期较多的是「${stats.mostDelayedTag}」类`);
    if (Array.isArray(stats.coreGoalTags) && stats.coreGoalTags.length) {
      parts.push(`本周核心关注：${stats.coreGoalTags.join("、")}`);
    }
    if (stats.deepWorkShare != null) {
      parts.push(`深度相关事务约占${Math.round(stats.deepWorkShare * 100)}%`);
    }
    return parts.join("；");
  }
  if (scene === "body_daily") {
    return stats.hasCheckin ? "今日已有身体边界记录。" : "今日尚无身体边界记录。";
  }
  if (scene === "task_create") {
    const pref = (stats.preferenceTags || []).slice(0, 3).join("、");
    const bits = [];
    if (stats.weekday && stats.slot) bits.push(`当前为${stats.weekday}${stats.slot}`);
    if (stats.taskCategory) bits.push(`任务类别为${stats.taskCategory}`);
    if (pref) bits.push(`近期偏好标签包括${pref}`);
    return bits.join("；");
  }
  return "";
}

function buildContinuation(scene, narrative, ruleKey) {
  /** 身体周报 / 时间周报：规则句已自足，不再拼固定「元话语」续写（接 LLM 后再在此处接短续写） */
  if (scene === "body_week" || scene === "weekly_time") return "";
  if (!narrative) return "";
  if (scene === "body_daily") {
    return "小麟在这儿，陪您慢慢听一听身体的边界。";
  }
  if (ruleKey) return "";
  if (scene === "task_create") {
    return "小麒陪您从当下这一刻开始，不必急着证明什么。";
  }
  return "";
}

function postFilterBlacklist(text) {
  if (!text || typeof text !== "string") return { ok: false, reason: "empty" };
  if (BLACKLIST_RE.test(text)) return { ok: false, reason: "blacklist" };
  return { ok: true };
}

function cacheKey(scene, stats, openidHash) {
  const weekKey = stats.weekKey || stats.dateKey || "";
  const hits = normalizeHits(stats.hits).join(",");
  return [scene, DATA_SCHEMA_VERSION, PROMPT_TEMPLATE_VERSION, MODEL_ID, openidHash, weekKey, hits].join(
    ":",
  );
}

function getCached(key) {
  const item = cache.get(key);
  if (!item) return null;
  if (Date.now() - item.at > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return item.text;
}

function setCached(key, text) {
  cache.set(key, { at: Date.now(), text });
}

function composeText(ruleKey, continuation) {
  const ruleText = ruleKey ? RULE_TEXT[ruleKey] || "" : "";
  if (ruleText && continuation) return `${ruleText}${continuation}`;
  if (ruleText) return ruleText;
  if (continuation) return continuation;
  return "";
}

async function generateMascotCopy(event, wxContext) {
  const scene = event && event.scene;
  const statsIn = (event && event.stats) || {};
  const dataSchemaVersion = (event && event.dataSchemaVersion) || DATA_SCHEMA_VERSION;

  if (!scene || !SCENE_ALLOWED_STATS[scene]) {
    return { success: false, errMsg: "invalid scene", text: RULE_TEXT.neutral_xiaolin };
  }
  if (String(dataSchemaVersion) !== DATA_SCHEMA_VERSION) {
    return { success: false, errMsg: "unsupported dataSchemaVersion", text: RULE_TEXT.neutral_xiaolin };
  }

  const openidHash = hashOpenIdPrefix(wxContext && wxContext.OPENID);
  const stats = pickAllowedStats(scene, statsIn);
  const hits = normalizeHits(stats.hits);
  const ck = cacheKey(scene, stats, openidHash);
  const cached = getCached(ck);
  if (cached) {
    return {
      success: true,
      text: cached,
      cached: true,
      meta: {
        dataSchemaVersion: DATA_SCHEMA_VERSION,
        promptTemplateVersion: PROMPT_TEMPLATE_VERSION,
        modelId: MODEL_ID,
        openidHash,
        scene,
      },
    };
  }

  try {
    const ruleKey = pickRuleHit(scene, hits);
    const narrative = buildNarrative(scene, stats);
    const continuation = buildContinuation(scene, narrative, ruleKey);
    let text = composeText(ruleKey, continuation);

    if (!text) {
      text =
        scene === "task_create" ? RULE_TEXT.neutral_xiaoqi : RULE_TEXT.neutral_xiaolin;
    }

    const filtered = postFilterBlacklist(text);
    if (!filtered.ok) {
      text =
        scene === "task_create" ? RULE_TEXT.neutral_xiaoqi : RULE_TEXT.neutral_xiaolin;
    }

    setCached(ck, text);
    return {
      success: true,
      text,
      cached: false,
      meta: {
        dataSchemaVersion: DATA_SCHEMA_VERSION,
        promptTemplateVersion: PROMPT_TEMPLATE_VERSION,
        modelId: MODEL_ID,
        openidHash,
        scene,
        ruleKey: ruleKey || null,
        hits,
        blacklistDropped: !filtered.ok,
      },
    };
  } catch (e) {
    return {
      success: false,
      errMsg: e && e.message ? e.message : String(e),
      text: RULE_TEXT.infra_error,
      infraError: true,
      meta: {
        dataSchemaVersion: DATA_SCHEMA_VERSION,
        promptTemplateVersion: PROMPT_TEMPLATE_VERSION,
        modelId: MODEL_ID,
        openidHash,
        scene,
      },
    };
  }
}

module.exports = {
  DATA_SCHEMA_VERSION,
  PROMPT_TEMPLATE_VERSION,
  MODEL_ID,
  generateMascotCopy,
  postFilterBlacklist,
  RULE_TEXT,
};
