/**
 * 阶段 0：身体周报版面压测占位文案（仅开发/预览用）
 *
 * 启用：进入周报页时带参数，例如
 *   /subpkg/body-report/index?layoutFixture=1     → 状态约 75 字 + 气泡约 45 字 + 极值黄字
 *   /subpkg/body-report/index?layoutFixture=55  → 气泡约 55 字
 *   /subpkg/body-report/index?layoutFixture=45  → 气泡约 45 字、无极值黄字
 *
 * 上线前勿在正式路径传 layoutFixture；阶段 1 起由存档 + 模型接管。
 */

function countChars(text) {
  return [...String(text || "")].length;
}

/** 目标约 75 字：方案 D 状态卡上限压测 */
const STATUS_DESC_75 =
  "这周睡眠多数以睡得香为主，运动以动了点居多，身体信号多为没事；整体节奏在身心满格这一档，没有失眠、过载或疼痛记录，具体分布请看上方三张图哦。";

const CARE_TEXT_45 =
  "小麟看见：睡和信号都偏稳，运动略少一点；您已经照顾得很好，下周若想再进一步，每天多走几分钟就够。";

const CARE_TEXT_55 =
  "小麟看见：这周睡和信号都偏稳，运动略少一点；您已经照顾得很好，下周若想再进一步，每天多走几分钟、不必加码就够。";

const EXTREME_LINE_SAMPLE = "⚠️ 本周有过2天失眠 · 有过1天疼痛";

const VARIANTS = {
  "1": { careText: CARE_TEXT_45, withExtreme: true, label: "状态≈75字 · 气泡≈45字 · 含极值黄字" },
  "45": { careText: CARE_TEXT_45, withExtreme: false, label: "状态≈75字 · 气泡≈45字" },
  "55": { careText: CARE_TEXT_55, withExtreme: true, label: "状态≈75字 · 气泡≈55字 · 含极值黄字" },
};

/**
 * @param {object} [options] 页面 onLoad options
 * @returns {string} "" | "1" | "45" | "55"
 */
function resolveLayoutFixtureVariant(options) {
  const raw = options && options.layoutFixture != null ? String(options.layoutFixture).trim() : "";
  if (!raw) return "";
  if (VARIANTS[raw]) return raw;
  if (raw === "true" || raw === "yes") return "1";
  return "";
}

/**
 * @param {string} variantKey
 * @returns {{ statusDesc: string, careText: string, extremeLine: string, statusTitle: string, banner: string, meta: object }|null}
 */
function getLayoutFixture(variantKey) {
  const key = variantKey || "1";
  const row = VARIANTS[key];
  if (!row) return null;
  const statusDesc = STATUS_DESC_75;
  const careText = row.careText;
  const extremeLine = row.withExtreme ? EXTREME_LINE_SAMPLE : "";
  return {
    statusTitle: "身心满格",
    statusDesc,
    careText,
    extremeLine,
    banner: `【版面压测】${row.label}`,
    meta: {
      statusDescChars: countChars(statusDesc),
      careTextChars: countChars(careText),
      variant: key,
    },
  };
}

module.exports = {
  resolveLayoutFixtureVariant,
  getLayoutFixture,
  countChars,
  STATUS_DESC_75,
  CARE_TEXT_45,
  CARE_TEXT_55,
};
