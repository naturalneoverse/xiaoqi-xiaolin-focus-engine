"use strict";

const { handleGenerateQuadrantQ3StageA } = require("./generateQuadrantQ3S2");

/** 云开发测试：{ "action": "arkProbeQ3StageA" } — 真实 c0 全流程（小麒·防幻觉·写库） */
const PROBE_ITEMS = [
  {
    cardField: "c0",
    userText: "孩子的作业、老人的情绪，我常当成自己的事",
    agentType: "xiaoqi",
    question: "哪些是你自己的课题，哪些是别人的？",
  },
  {
    cardField: "c1",
    userText: "【题目】有没有为了被认可而做？\n【用户选择】有时会",
    agentType: "xiaoqi",
    question: "有没有为了被认可而做？",
  },
  {
    cardField: "c2",
    userText: "先每天留半小时给自己",
    agentType: "xiaoqi",
    question: "放下不属于你的，你最想做什么，怎么做？",
  },
];

/**
 * @param {object} db
 */
async function handleArkProbeQ3StageA(db) {
  const started = Date.now();
  const out = await handleGenerateQuadrantQ3StageA(db, {
    taskId: `probe-q3-${Date.now()}`,
    quadrantId: 3,
    taskTitle: "云函数探测",
    items: PROBE_ITEMS,
  });
  const reply = out && out.reply;
  const preview = reply && reply.replyContent ? String(reply.replyContent).slice(0, 60) : "";
  return {
    action: "arkProbeQ3StageA",
    ok: !!(out && out.ok),
    errCode: out && out.ok ? "OK" : (out && out.primaryErrCode) || (reply && reply.errCode) || "FAIL",
    durationMs: Date.now() - started,
    replyChars: preview ? Array.from(String(reply.replyContent)).length : 0,
    textPreview: preview,
    fromCache: !!(reply && reply.fromCache),
  };
}

module.exports = { handleArkProbeQ3StageA };
