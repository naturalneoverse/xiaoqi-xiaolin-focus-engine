"use strict";

const C = require("./bodyWeekCareConstants");

const WEEK_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * @param {object} event
 */
function validateGenerateBodyWeekCareParams(event) {
  const bullets = event && event.bullets;
  if (!Array.isArray(bullets) || bullets.length < 1) {
    return { ok: false, errCode: "INVALID_BULLETS" };
  }
  const normalizedBullets = bullets
    .map((b) => ({
      type: String((b && b.type) || "").trim(),
      text: String((b && b.text) || "").trim(),
    }))
    .filter((b) => b.text);
  if (!normalizedBullets.length) {
    return { ok: false, errCode: "INVALID_BULLETS" };
  }

  const weekKey = String((event && event.weekKey) || "").trim();
  if (!WEEK_KEY_RE.test(weekKey)) {
    return { ok: false, errCode: "INVALID_WEEK_KEY" };
  }

  const dayCount = Number(event && event.dayCount);
  if (!Number.isFinite(dayCount) || dayCount < C.SPARSE_MIN_VALID_DAYS) {
    return { ok: false, errCode: "SPARSE_WEEK" };
  }

  const finalStatusTitle = String((event && event.finalStatusTitle) || "").trim();
  if (!finalStatusTitle) {
    return { ok: false, errCode: "INVALID_STATUS_TITLE" };
  }

  return {
    ok: true,
    payload: {
      bullets: normalizedBullets,
      weekKey,
      dayCount,
      finalStatusTitle,
    },
  };
}

/**
 * @param {string} text
 * @returns {object|null}
 */
function extractJsonObject(text) {
  const s = String(text || "").trim();
  if (!s) return null;
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fence ? fence[1].trim() : s;
  try {
    return JSON.parse(raw);
  } catch (e) {
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try {
      return JSON.parse(m[0]);
    } catch (e2) {
      return null;
    }
  }
}

/**
 * @param {object[]} bullets
 * @returns {string[]}
 */
function listRequiredExtremeTypes(bullets) {
  const types = [];
  (bullets || []).forEach((b) => {
    const t = String((b && b.type) || "").trim();
    if (t.startsWith("EXTREME_") && t !== "EXTREME_NONE") types.push(t);
  });
  return types;
}

/**
 * @param {string} statusDesc
 * @param {string[]} extremeTypes
 */
function statusDescCoversExtremes(statusDesc, extremeTypes) {
  const s = String(statusDesc || "");
  for (let i = 0; i < extremeTypes.length; i += 1) {
    const keywords = C.EXTREME_STATUS_KEYWORDS[extremeTypes[i]];
    if (!keywords || !keywords.length) continue;
    const hit = keywords.some((kw) => s.includes(kw));
    if (!hit) return false;
  }
  return true;
}

/**
 * @param {string} statusDesc
 * @param {string} careText
 */
function careTextRepeatsStatusDesc(statusDesc, careText) {
  const a = String(statusDesc || "").trim();
  const b = String(careText || "").trim();
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.includes(b) && b.length >= 20) return true;
  if (b.length >= 12 && a.includes(b.slice(0, 12))) return true;
  return false;
}

/**
 * @param {object[]} bullets
 * @param {{ statusDesc?: string, careText?: string }} parsed
 * @returns {{ ok: boolean, errCode?: string, statusDesc?: string, careText?: string }}
 */
function assessBodyWeekCareOutput(bullets, parsed) {
  if (!parsed || typeof parsed !== "object") {
    return { ok: false, errCode: "PARSE_JSON_FAILED" };
  }

  const statusDesc = String(parsed.statusDesc || "").trim();
  const careText = String(parsed.careText || "").trim();
  if (!statusDesc || !careText) {
    return { ok: false, errCode: "OUTPUT_FIELD_MISSING" };
  }

  const lenS = C.checkCopyLength("statusDesc", statusDesc);
  if (!lenS.ok) return { ok: false, errCode: lenS.reason || "STATUS_DESC_LENGTH" };

  const lenC = C.checkCopyLength("careText", careText);
  if (!lenC.ok) return { ok: false, errCode: lenC.reason || "CARE_TEXT_LENGTH" };

  const forbiddenS = C.findForbiddenUserCopyHits(statusDesc);
  if (!forbiddenS.ok) return { ok: false, errCode: "FORBIDDEN_STATUS_DESC" };

  const forbiddenC = C.findForbiddenUserCopyHits(careText);
  if (!forbiddenC.ok) return { ok: false, errCode: "FORBIDDEN_CARE_TEXT" };

  const extremeTypes = listRequiredExtremeTypes(bullets);
  if (extremeTypes.length && !statusDescCoversExtremes(statusDesc, extremeTypes)) {
    return { ok: false, errCode: "EXTREME_NOT_IN_STATUS_DESC" };
  }

  if (careTextRepeatsStatusDesc(statusDesc, careText)) {
    return { ok: false, errCode: "CARE_TEXT_REPEATS_STATUS" };
  }

  return { ok: true, statusDesc, careText };
}

module.exports = {
  validateGenerateBodyWeekCareParams,
  extractJsonObject,
  assessBodyWeekCareOutput,
  listRequiredExtremeTypes,
  statusDescCoversExtremes,
  careTextRepeatsStatusDesc,
};
