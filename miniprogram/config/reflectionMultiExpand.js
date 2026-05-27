/** 象限四多选：选项下方 inline 展开录入 */

const EXPAND_SHORT_MAX = 25;
const EXPERIENCE_MAX = 300;

const EXPAND_ROWS = [
  {
    key: "experience",
    optionId: "experience",
    label: "带给自己一个经验",
    placeholder: "值得继续的做法，或下次可以调整的地方",
    maxLength: EXPERIENCE_MAX,
    multiline: true,
  },
  {
    key: "feeling",
    optionId: "feeling",
    label: "带给自己一个感受",
    placeholder: "某个难忘的时刻...",
    maxLength: EXPAND_SHORT_MAX,
    multiline: false,
  },
  {
    key: "decision",
    optionId: "decision",
    label: "带给自己一个决定",
    placeholder: "接下来要做什么或不再做什么...",
    maxLength: EXPAND_SHORT_MAX,
    multiline: false,
  },
];

function createEmptyMultiExpandValues() {
  return { experience: "", feeling: "", decision: "" };
}

module.exports = {
  EXPAND_SHORT_MAX,
  EXPERIENCE_MAX,
  EXPAND_ROWS,
  createEmptyMultiExpandValues,
};
