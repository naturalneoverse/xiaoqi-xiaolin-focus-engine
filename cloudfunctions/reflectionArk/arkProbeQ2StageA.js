"use strict";

const { handleGenerateQuadrantQ2StageA } = require("./generateQuadrantQ2S2");

/** 云开发测试：{ "action": "arkProbeQ2StageA" } — 真实 c0 全流程（人设+280字档+写库） */
const PROBE_ITEMS = [
  {
    cardField: "c0",
    userText: "时间太紧，人手不够",
    agentType: "xiaolin",
    question: "这件事有什么让你觉得「卡住了」？",
  },
  {
    cardField: "c1",
    userText: "着急",
    agentType: "xiaolin",
    question: "这件事，碰到了你心里的哪根弦？",
  },
  {
    cardField: "c2",
    userText: "把这个事尽快做好",
    agentType: "xiaolin",
    question: "在这件事里，你觉得什么是你真正在意的？",
  },
];

/**
 * @param {object} db
 */
async function handleArkProbeQ2StageA(db) {
  const started = Date.now();
  const out = await handleGenerateQuadrantQ2StageA(db, {
    taskId: `probe-${Date.now()}`,
    quadrantId: 2,
    taskTitle: "云函数探测",
    items: PROBE_ITEMS,
  });
  const reply = out && out.reply;
  const preview = reply && reply.replyContent ? String(reply.replyContent).slice(0, 60) : "";
  return {
    action: "arkProbeQ2StageA",
    ok: !!(out && out.ok),
    errCode: out && out.ok ? "OK" : (out && out.primaryErrCode) || (reply && reply.errCode) || "FAIL",
    durationMs: Date.now() - started,
    replyChars: preview ? Array.from(String(reply.replyContent)).length : 0,
    textPreview: preview,
    fromCache: !!(reply && reply.fromCache),
  };
}

module.exports = { handleArkProbeQ2StageA };
