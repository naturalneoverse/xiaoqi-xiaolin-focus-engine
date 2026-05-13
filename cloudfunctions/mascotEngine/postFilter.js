/**
 * 黑名单：命中则整段作废，改用降级句（禁止返回空串，避免 UI 像故障）。
 * 仅匹配完整短语语义，与产品约定一致。
 */

const FORBIDDEN_RE = /得分|评分|分数|不合格|不达标/;

const FALLBACK_BY_SCENE = {
  body_daily: "小麟在这儿，陪你慢慢听一听身体的边界。",
  body_week: "小麟在这儿陪着你。这一周，先照顾好此刻的自己。",
  weekly_time: "小麒在这儿。按你的节奏来，一步一步就好。",
  task_create: "小麒在这儿。按你的节奏来，一步一步就好。",
};

function pickFallback(scene) {
  const key = scene && FALLBACK_BY_SCENE[scene] ? scene : null;
  return key ? FALLBACK_BY_SCENE[key] : "小麟在这儿陪着你。这一周，先照顾好此刻的自己。";
}

function filterWithFallback(text, opts) {
  const scene = opts && opts.scene;
  const fallback = pickFallback(scene);
  if (text == null || String(text).trim() === "") return fallback;
  const s = String(text);
  if (FORBIDDEN_RE.test(s)) return fallback;
  return s;
}

module.exports = {
  filterWithFallback,
  FORBIDDEN_RE,
};
