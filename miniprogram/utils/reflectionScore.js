/**
 * 复盘报告「哲思复盘」四象限得分（0–120），从已存 cardResponses 实时计算
 */

const { getQuadrantCards, resolveSingleSelected } = require("../config/reflectionQuadrantCards");
const reflectionManager = require("./reflectionManager");

function textFilled(resp) {
  return !!(resp && resp.type === "text" && typeof resp.text === "string" && resp.text.trim().length > 0);
}

function respAt(entry, index) {
  const list = entry && Array.isArray(entry.cardResponses) ? entry.cardResponses : [];
  return list[index] || null;
}

/** 象限一：40 + 单选(40/30/20/10) + 40 */
function scoreQuadrant1(entry) {
  if (!entry) return 0;
  const cards = getQuadrantCards(1);
  let s = 0;
  const r0 = respAt(entry, 0);
  const r1 = respAt(entry, 1);
  const r2 = respAt(entry, 2);
  if (textFilled(r0)) s += 40;
  if (r1 && r1.type === "single" && cards[1]) {
    const id = resolveSingleSelected(cards[1], r1);
    const map = { full: 40, routine: 30, distracted: 20, forced: 10 };
    s += map[id] != null ? map[id] : 0;
  }
  if (textFilled(r2)) s += 40;
  return Math.min(120, s);
}

/** 象限二：三文本各 40 */
function scoreQuadrant2(entry) {
  if (!entry) return 0;
  let s = 0;
  for (let i = 0; i < 3; i++) {
    if (textFilled(respAt(entry, i))) s += 40;
  }
  return Math.min(120, s);
}

/** 象限三：40 + 单选(10/15/20) + 40 */
function scoreQuadrant3(entry) {
  if (!entry) return 0;
  const cards = getQuadrantCards(3);
  let s = 0;
  const r0 = respAt(entry, 0);
  const r1 = respAt(entry, 1);
  const r2 = respAt(entry, 2);
  if (textFilled(r0)) s += 40;
  if (r1 && r1.type === "single" && cards[1]) {
    const id = resolveSingleSelected(cards[1], r1);
    const map = { mostly: 10, somewhat: 15, none: 20 };
    s += map[id] != null ? map[id] : 0;
  }
  if (textFilled(r2)) s += 40;
  return Math.min(120, s);
}

/** 象限四：40 + 40 + 多选累加（15+15+10 封顶 40），与 nothing 不互斥计分 */
function scoreQuadrant4Multi(r2) {
  if (!r2 || r2.type !== "multi") return 0;
  const sel = Array.isArray(r2.selected) ? r2.selected : [];
  let sum = 0;
  if (sel.indexOf("experience") >= 0) sum += 15;
  if (sel.indexOf("feeling") >= 0) sum += 15;
  if (sel.indexOf("decision") >= 0) sum += 10;
  return Math.min(40, sum);
}

/** 象限四：第1题40 + 第2题40 + 第3题至多40 */
function scoreQuadrant4(entry) {
  if (!entry) return 0;
  let s = 0;
  const r0 = respAt(entry, 0);
  const r1 = respAt(entry, 1);
  const r2 = respAt(entry, 2);
  if (textFilled(r0)) s += 40;
  if (textFilled(r1)) s += 40;
  s += scoreQuadrant4Multi(r2);
  return Math.min(120, s);
}

/**
 * @param {object|null} record
 * @returns {{ q1: number, q2: number, q3: number, q4: number }}
 */
function computeQuadrantScores(record) {
  const empty = { q1: 0, q2: 0, q3: 0, q4: 0 };
  if (!record || !record.quadrants) return empty;
  const q = (id) => {
    const e = reflectionManager.getQuadrantEntry(record, id);
    return e || null;
  };
  return {
    q1: scoreQuadrant1(q(1)),
    q2: scoreQuadrant2(q(2)),
    q3: scoreQuadrant3(q(3)),
    q4: scoreQuadrant4(q(4)),
  };
}

module.exports = {
  computeQuadrantScores,
  scoreQuadrant1,
  scoreQuadrant2,
  scoreQuadrant3,
  scoreQuadrant4,
};
