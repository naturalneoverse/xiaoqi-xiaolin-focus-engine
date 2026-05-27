"use strict";

const { loadDashscopeEnv, isDashscopeEnvReady } = require("./dashscopeEnv");
const { handleGenerateBodyWeekCare } = require("./generateBodyWeekCare");
const { DEPLOY_TAG } = require("./constants");

/** 云测用：满格 + 极值降档样例 bullet（与 miniprogram bodyWeekBullets.fixtures 对齐） */
const PROBE_BULLETS = Object.freeze([
  { type: "BAND", text: "BAND: 展示档位状态平稳（由身心满格降一档，因本周极值类型≥2类）" },
  { type: "DAYS", text: "DAYS: 有效记录5天" },
  { type: "SLEEP_DOM", text: "SLEEP_DOM: 睡得香（本周占比最高）" },
  { type: "SPORT_DOM", text: "SPORT_DOM: 动够了（本周占比最高）" },
  { type: "SIGNAL_DOM", text: "SIGNAL_DOM: 没事（本周占比最高）" },
  { type: "EXTREME_SLEEP", text: "EXTREME_SLEEP: 本周1天睡不着" },
  { type: "EXTREME_SIGNAL", text: "EXTREME_SIGNAL: 本周1天疼了" },
  { type: "DOWNGRADE", text: "DOWNGRADE: 展示档位状态平稳；规则档位身心满格；因极值降一档" },
]);

/**
 * 云开发控制台：{ "action": "bodyWeekCareProbe" } — 调用百炼生成两段（不写缓存）
 */
async function handleBodyWeekCareProbe() {
  const env = loadDashscopeEnv();
  if (!isDashscopeEnvReady(env)) {
    return {
      ok: false,
      action: "bodyWeekCareProbe",
      errCode: "DASHSCOPE_ENV_MISSING",
      deployTag: DEPLOY_TAG,
    };
  }

  const started = Date.now();
  const out = await handleGenerateBodyWeekCare(null, {
    bullets: PROBE_BULLETS,
    weekKey: "2025-05-19",
    dayCount: 5,
    finalStatusTitle: "状态平稳",
  });

  return {
    ok: !!out.ok,
    action: "bodyWeekCareProbe",
    deployTag: DEPLOY_TAG,
    errCode: out.ok ? "OK" : out.errCode || "BODY_WEEK_CARE_FAILED",
    durationMs: Date.now() - started,
    modelQ1: env.modelQ1,
    statusDescChars: out.statusDescChars || 0,
    careTextChars: out.careTextChars || 0,
    statusDescPreview: out.statusDesc ? String(out.statusDesc).slice(0, 80) : "",
    careTextPreview: out.careText ? String(out.careText).slice(0, 60) : "",
  };
}

module.exports = {
  handleBodyWeekCareProbe,
  PROBE_BULLETS,
};
