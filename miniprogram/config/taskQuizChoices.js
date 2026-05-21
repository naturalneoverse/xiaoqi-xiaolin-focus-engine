/**
 * 任务创建答题：仅选项骨架（序号 1–4 + 标题 + 说明），不含 64 组陪伴文案。
 * 编码顺序：优先级 + 圈层 + 行事层次 → 三位数字组合码（如 214）。
 * 圈层合并定义：选项 4「不二」= 自他不二，不得改名或拆项。
 */

const PRIORITY_OPTIONS = [
  { id: 1, title: "重要且紧急", desc: "必须马上做，不做会出事" },
  { id: 2, title: "重要不紧急", desc: "真正重要的事，可以慢慢做" },
  { id: 3, title: "紧急不重要", desc: "别人催得紧，对你没那么重要" },
  { id: 4, title: "不重要不紧急", desc: "这件事，真的需要做吗？" },
];

const CIRCLE_OPTIONS = [
  { id: 1, title: "自己", desc: "照顾身体、日常事务、自己的事" },
  { id: 2, title: "至亲挚友", desc: "家人长辈、孩子伴侣、知心好友，亲近之人" },
  { id: 3, title: "外缘", desc: "老板、同事、客户、社会事务" },
  { id: 4, title: "不二", desc: "自他不二，同时为自己也为别人" },
];

const LAYER_OPTIONS = [
  { id: 1, title: "生计", desc: "为了生存，做了才能活下去" },
  { id: 2, title: "职责", desc: "角色赋予你的责任，你在建造什么" },
  { id: 3, title: "真我", desc: "发自内心的，让你更接近自己的事" },
  { id: 4, title: "合一", desc: "生计、职责、真我，三层合一" },
];

const QUIZ_SECTIONS = [
  {
    key: "priority",
    stepLabel: "1",
    title: "轻重缓急？",
    icon: "/images/transparent background/important.png",
    iconClass: "",
    options: PRIORITY_OPTIONS,
  },
  {
    key: "circle",
    stepLabel: "2",
    title: "为谁而做？",
    icon: "/images/transparent background/who.png",
    iconClass: "title-icon-who",
    options: CIRCLE_OPTIONS,
  },
  {
    key: "layer",
    stepLabel: "3",
    title: "行事层次？",
    icon: "/images/transparent background/why.png",
    iconClass: "",
    options: LAYER_OPTIONS,
  },
];

function findOptionTitle(options, id) {
  const n = Number(id);
  const row = (options || []).find((o) => o.id === n);
  return row ? row.title : "";
}

function labelsFromIds(priorityId, circleId, layerId) {
  return {
    priority: findOptionTitle(PRIORITY_OPTIONS, priorityId),
    circle: findOptionTitle(CIRCLE_OPTIONS, circleId),
    layer: findOptionTitle(LAYER_OPTIONS, layerId),
  };
}

module.exports = {
  PRIORITY_OPTIONS,
  CIRCLE_OPTIONS,
  LAYER_OPTIONS,
  QUIZ_SECTIONS,
  labelsFromIds,
  findOptionTitle,
};
