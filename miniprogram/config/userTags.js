/**
 * 首次登录标签（与云函数 saveUserTags / getUserTags 的 id 一致）
 */
const GENDER_OPTIONS = [
  { id: "she", label: "她" },
  { id: "he", label: "他" },
  { id: "na", label: "不必定义" },
];

const LIFE_STAGE_OPTIONS = [
  { id: "starting", label: "刚出发（还在念书或刚工作）" },
  { id: "pushing", label: "正在冲（打拼期，尝试各种赛道）" },
  { id: "halfway", label: "半山腰（稳住了，想偶尔喘口气）" },
  { id: "enjoying", label: "看风景（想换种活法或享受生活）" },
];

const ROLE_OPTIONS = [
  { id: "cattle", label: "从业者" },
  { id: "herder", label: "管理者" },
  { id: "boss", label: "自己当老板" },
  { id: "resting", label: "暂时休整" },
  { id: "parent", label: "当爸妈的" },
  { id: "child", label: "当儿女的" },
  { id: "partnered", label: "有伴儿的人" },
  { id: "solo", label: "独自快活" },
  { id: "exploring", label: "探索自我中" },
];

module.exports = {
  GENDER_OPTIONS,
  LIFE_STAGE_OPTIONS,
  ROLE_OPTIONS,
};
