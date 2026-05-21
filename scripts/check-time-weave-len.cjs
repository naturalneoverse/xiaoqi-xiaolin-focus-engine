const opening = require("../miniprogram/config/timeWeaveOpening.js");
const { TIME_WEAVE_COPY } = require("../miniprogram/config/timeWeaveMascotCopy.js");
const {
  countCopyChars,
  OPENING_CHAR_LENGTHS,
  BODY_CHAR_LENGTH_BY_KEY,
} = require("../miniprogram/config/timeWeaveCopyLimits.js");

const len = countCopyChars;

console.log("=== Opening (product spec) ===");
opening.xiaoLinOpening.forEach((t, i) => {
  const l = len(t);
  const spec = OPENING_CHAR_LENGTHS[i];
  const ok = spec == null || l === spec ? "OK" : `EXPECTED ${spec}`;
  console.log(i + 1, l, ok, t);
});

console.log("\n=== Body ===");
Object.entries(BODY_CHAR_LENGTH_BY_KEY).forEach(([k, target]) => {
  TIME_WEAVE_COPY[k].forEach((t, i) => {
    const l = len(t);
    if (l !== target) console.log(k, i + 1, l, "!=", target, t);
  });
});
