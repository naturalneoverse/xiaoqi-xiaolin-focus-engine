const { buildResponseFromDoc, VALID_KEYS } = require("./logic");

const sample = {
  copyKey: "oneSelf",
  lineIndex: 3,
  text: "循着心底想法前行，不必刻意迎合外物。",
};

const ok = buildResponseFromDoc(sample);
if (!ok.success || ok.text !== sample.text) throw new Error("build ok failed");

const bad = buildResponseFromDoc({ copyKey: "nope", lineIndex: 1, text: "x" });
if (bad.success) throw new Error("invalid key should fail");

console.log("[getTimeWeaveCopy smoke-local] OK", VALID_KEYS.size, "keys");
