/** 象限四 KISS 极简复盘（Step 21） */

const KISS_MAX = 50;

const KISS_ROWS = [
  {
    key: "keep",
    label: "K·保持",
    placeholder: "值得继续的做法",
    required: true,
    emphasize: true,
  },
  {
    key: "improve",
    label: "I·改进",
    placeholder: "下次可以调整的地方",
    required: true,
    emphasize: true,
  },
  {
    key: "start",
    label: "S·开始",
    placeholder: "想开始的一项小行动（选填）",
    required: false,
    emphasize: false,
  },
  {
    key: "stop",
    label: "S·停止",
    placeholder: "想停止的一个习惯（选填）",
    required: false,
    emphasize: false,
  },
];

function createEmptyKissValues() {
  return { keep: "", improve: "", start: "", stop: "" };
}

module.exports = {
  KISS_MAX,
  KISS_ROWS,
  createEmptyKissValues,
};
