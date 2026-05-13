/**
 * 规则引擎（MVP）：按 scene + subType 出定稿句；无命中则给场景中性句。
 * 后续可接 LLM：在 index 里于本函数之后拼接续写，再过 postFilter。
 */

const { resolveBodyWeekFromHits } = require("./rulesBodyWeek");
const { resolveWeeklyTimeFromHits } = require("./rulesWeekly");

const BODY_DAILY_MAP = {
  sleep_睡得香: "这一觉睡得踏实，睡好了今天就有底气。",
  sleep_做梦了: "做了很多梦吧，那是大脑在帮你整理。",
  sleep_睡不实: "夜里醒了几次，没关系，起伏本身就是生命的节奏。",
  sleep_睡不着: "没睡着也别怪自己，身体知道你需要什么，今晚再试试。",
  sport_动够了: "身体被充分激活了，每一滴汗都在帮你清理疲惫。",
  sport_动了点: "动了就好，不追求多，身体要的是你的记得。",
  sport_没咋动: "今天没动也没关系，明天散个步就行。",
  sport_动过头了: "感觉到累了吧，明天缓一缓，休息也是运动的一部分。",
  signal_没事: "身体平安的信号收到了，这是今天最好的消息。",
  signal_有劲: "浑身是劲的感觉真好，记住这个状态。",
  signal_累了: "累了就歇，不扛着。身体在教你：真正的强大不是硬撑，是知道自己该停。",
  signal_疼了: "哪里疼，就是哪里在喊你听见它。身体从不撒谎，疼是它最后的语言。",
};

const SCENE_NEUTRAL = {
  body_daily: "今天还没和身体打招呼。有空时，给身体留个空白也好。",
  body_week: "小麟在这儿陪着你。这一周，先照顾好此刻的自己。",
  weekly_time: "小麒在这儿。按你的节奏来，一步一步就好。",
  task_create: "小麒在这儿。按你的节奏来，一步一步就好。",
};

function getRuleText(ruleSceneType, ruleSubType, stats) {
  const scene = ruleSceneType || "";
  const sub = ruleSubType || "";

  if (scene === "body_week") {
    const fromHits = resolveBodyWeekFromHits(stats && stats.hits);
    if (fromHits) return fromHits;
    return SCENE_NEUTRAL.body_week;
  }

  if (scene === "weekly_time") {
    const fromHits = resolveWeeklyTimeFromHits(stats && stats.hits);
    if (fromHits) return fromHits;
    return SCENE_NEUTRAL.weekly_time;
  }

  if (scene === "body_daily" && sub && BODY_DAILY_MAP[sub]) {
    return BODY_DAILY_MAP[sub];
  }

  if (scene && SCENE_NEUTRAL[scene]) {
    return SCENE_NEUTRAL[scene];
  }

  return SCENE_NEUTRAL.body_daily;
}

module.exports = {
  getRuleText,
  BODY_DAILY_MAP,
};
