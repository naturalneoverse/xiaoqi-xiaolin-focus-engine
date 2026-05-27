/**
 * 各象限提交后结语气泡（Step 16+）
 */

const Q1_BUBBLE1_BY_SINGLE = {
  full: "那段时间，您完全属于您自己。",
  routine: "有序也是一种安稳。您在您的轨道上。",
  distracted: "心在别处也没关系。您看见了，就已经回来了。",
  forced: "辛苦了。有些事就是用来完成的，不是用来享受的。完成本身就值得尊重。",
};

/** 象限一第三题占位 / 提交后第二气泡 */
const Q1_BUBBLE2 =
  "悬置判断之后，你会看见这件事本身。不评判，只是看见。这份纯粹的看见——觉察，就从这里生长。";

/** 象限二：观心明己 — 提交后结语气泡（6 行手动换行 + 弹层全文居中） */
const Q2_BUBBLE_LINES = [
  "卡住的地方，",
  "往往就是最在意的地方。",
  "小麟陪着您，",
  "先把这根弦看见就好。",
  "完整回响正在写入报告，",
  "稍后可查看。",
].join("\n");

/** @returns {string[]} 单气泡一步「知道了」 */
function buildQ2ConclusionBubbles() {
  return [Q2_BUBBLE_LINES];
}

/** 结论文案弹层是否全文居中（仅 Q2） */
function isQuadrantConclusionBubbleCentered(quadrantId) {
  return Number(quadrantId) === 2;
}

/** 象限三：自我主宰 — 单选映射气泡1 + 固定气泡2（小麒·解绑） */
const Q3_BUBBLE1_BY_SINGLE = {
  mostly: "你看见了驱动自己的东西。这不是错，这是自我认识。",
  somewhat: "你已经在有意识地区分了。觉察本身就是改变的开始。",
  none: "你在为自己而做。这就是阿德勒说的目的论——你做这件事，是因为你选择做。",
};

const Q3_BUBBLE2 = "放下别人的课题，就是你给自己最好的礼物。";

/** 象限四：踏实前行 — 提交后结语气泡（小麒） */
const Q4_BUBBLE2 = "留给自己的会成为力量，放下的都归于平和。";

/** 四象限全部完成后的通用总结（Step 23，小麒双气泡，仅首次凑齐触发一次） */
const GENERAL_SUMMARY = {
  agent: "xiaoqi",
  accent: "#2E6B3E",
  bubbleColor: "#c5ddc5",
  bubbles: [
    "你静静看见了整件事的全貌，也看清了当下的自己。",
    "愿意留下的都成为养分，坦然放下的都归于平和。",
  ],
};

function findSingleResponse(cardResponses) {
  return (cardResponses || []).find((r) => r && r.type === "single") || null;
}

function buildQuadrantConclusions(quadrantId, cardResponses) {
  const id = Number(quadrantId);
  if (id === 1) {
    const single = findSingleResponse(cardResponses);
    const selected = single && single.selected;
    const bubble1 =
      (selected && Q1_BUBBLE1_BY_SINGLE[selected]) || Q1_BUBBLE1_BY_SINGLE.routine;
    return [bubble1];
  }
  if (id === 2) {
    return buildQ2ConclusionBubbles();
  }
  if (id === 3) {
    const single = findSingleResponse(cardResponses);
    const selected = single && single.selected;
    const bubble1 =
      (selected && Q3_BUBBLE1_BY_SINGLE[selected]) || Q3_BUBBLE1_BY_SINGLE.somewhat;
    return [bubble1, Q3_BUBBLE2];
  }
  if (id === 4) {
    return [Q4_BUBBLE2];
  }
  return [];
}

module.exports = {
  Q1_BUBBLE1_BY_SINGLE,
  Q1_BUBBLE2,
  Q2_BUBBLE_LINES,
  buildQ2ConclusionBubbles,
  isQuadrantConclusionBubbleCentered,
  Q3_BUBBLE1_BY_SINGLE,
  Q3_BUBBLE2,
  Q4_BUBBLE2,
  GENERAL_SUMMARY,
  buildQuadrantConclusions,
};
