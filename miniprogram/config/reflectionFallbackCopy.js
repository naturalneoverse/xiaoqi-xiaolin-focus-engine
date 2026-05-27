/**
 * 哲思复盘 · 手写兜底文案（六套轮换，报告拼装用）
 * 套序：甲觉察 / 乙哲思 / 丙东方 / 丁心理 / 戊古典 / 己合辙
 * 一律不署名；展示层另加「小麟说：/小麒说：」
 */

const SET_COUNT = 6;

/** @type {Record<number, Record<string, string[]>>} */
const FALLBACK_BY_QUADRANT_CARD = {
  1: {
    c0: [
      "预期常跑在事实前面；肯停下来对照一次，本身就是归真。",
      "先悬置「应该怎样」，再看「实际怎样」；这一对照，比评判更接近真实。",
      "心若少一层成见，事实便会多一分清楚；如实，不是认输。",
      "未被说清的期待，往往在事实面前一再显形；看见它，便是清明。",
      "事有初末，也有偏差；把始末轻轻对齐，心就不至于被想象牵走。",
      "不一样并不可怕；可怕的是从未对照。您肯写，就已经在归真。",
    ],
    c2: [
      "评判暂歇时，细节才会开口；看见，比对错更接近真实。",
      "回到事情本身：少一层应该，多一层所见，便是观实。",
      "齐物不是糊是非，是少执取；执取少了，所见便真。",
      "态度可以先于境遇被选择；您选择先看见，已是回应。",
      "色不迷眼，事不遮心；所见若真，评判自会退后。",
      "好坏是后来的名，看见是当下的功；您已在做这件功。",
    ],
  },
  2: {
    c0: [
      "卡顿未必是要被立刻推开的事，有时是心在提醒您：这里有一份在乎。",
      "困处常常是意义尚未被命名的路口；先命名在乎，路会松一分。",
      "困即悟机；暗处有声，往往是牵挂尚未被听见。",
      "焦虑常伴自由而来；卡处，多是您尚未敢承认的在乎。",
      "风雨如晦，鸡鸣不已；暗处坚持，多是心尚未放下。",
      "卡，是停顿，不是判决；允许停一下，心会告诉您要什么。",
    ],
    c1: [
      "不适的背面，往往是尚未被承认的需要；承认它，内耗会松一分。",
      "价值感常在匮乏处显形；问清在乎什么，困顿便有了方向。",
      "虚静之下，真需自现；在乎被认出，卡顿便失其锐。",
      "情结背后，常是未整合的牵挂；整合从承认开始。",
      "中心藏之，何日忘之；在乎在中心，不在喧闹处。",
      "真正在乎的，往往安静；它一被您点名，就不再与己为敌。",
    ],
    c2: [
      "困境不必马上解开，也可以先问：它正在练您的哪一项耐心与清醒。",
      "每一次困境都是工夫；练的不只是成事，更是心定。",
      "格物亦格心；这一段，多半在磨定力，而非巧劲。",
      "人生课题反复出现，是为促整合；练的是接纳与承担。",
      "如切如磋，如琢如磨；磨的是心性，不只是事功。",
      "练习从不白来；它把您往更稳、更清的自己那边送一程。",
    ],
  },
  3: {
    c0: [
      "别人的事归还别人，自己的心就轻一些；分清课题，是给自己留力气。",
      "自由从分清开始：能改的用力，不能背的放下。",
      "君子求诸己；归位不是推诿，是把分寸收回己身。",
      "课题分离不是冷漠，是把心力留给可承担之处。",
      "未经省察的承担，不值得背上；分清，即省察。",
      "您只需回答属于自己的那部分；其余，放手亦是担当。",
    ],
    c2: [
      "收回不该背的分量，行动才会落在您真正能走的那条路上。",
      "念头若已清明，下一步不必宏大，但要真实可践。",
      "知是行之始；心定之后，宜小步、宜亲手、宜今日。",
      "意义在态度里生长；选定一步可践之路，胜过空叹。",
      "德性在践行中生成；做，比想更接近您要的答案。",
      "放下之后，最该出现的是一步您能完成的行动；这就够了。",
    ],
  },
  4: {
    c0: [
      "值得之事不必声势大；亲自去做，就是把注意力还给生命本身。",
      "关切只在当下：您肯亲手完成的那一件，就是此刻的要务。",
      "诚者自成；今日之重，在能诚实地做完一事。",
      "成为自己，落在行动里；价值在一件可完成的事上显形。",
      "可控者全力以赴；其余，不必用焦虑去填满。",
      "亲自，即是郑重；选一件，做完，心就有锚。",
    ],
    c1: [
      "明日不必从大处起手；把第一步缩到您能完成的大小，路就出现了。",
      "知止而后有定；先立一小步，意气自不涣散。",
      "千里之行，先在足下；足下要小到明日可践。",
      "明日之效，在今日可执行的最小单元；小步即反馈。",
      "万物流变；明晨之动，宜准、宜小、宜可备。",
      "开始不必漂亮，只要真实；真实的一步，最能安顿明晨。",
    ],
    c2_experience: [
      "经验不是负担，是已经走过的证据；留下它，下次您会更有分寸。",
      "理解总在经历之后；经验，是让下一次看得更准。",
      "学而时习；留下经验，是为下一次知止而后定。",
      "经验降不确定性；它是地图，不是包袱。",
      "实践智慧在重复中长成；留痕，即增一分把握。",
      "走过，就有证据；证据在，下次不必从零证明自己。",
    ],
    c2_feeling: [
      "感受不必立刻解释；先允许它在，心才有余地去分辨要什么。",
      "身体先理解世界；强烈之感，往往是方向在敲门。",
      "情通而理达；先通情，再理路，不必急着判对错。",
      "感受是信号，不是判决；先命名，再决定是否跟随。",
      "灵魂有其律动；难忘之感，值得被倾听与安置。",
      "感受不必立刻变成结论；安放好了，它会成为您的坐标。",
    ],
    c2_decision: [
      "决定本身就在划界：从此处起，您把力气用在选定的方向上。",
      "选择即向可能性承诺；选其一，便是收回立场。",
      "慎言慎行，亦是决断；决定即节制，把力用在选定的道上。",
      "决定不是失去自由，而是给自由一条可走的形状。",
      "取舍即承担；您选定的，就是愿为之负责的那条路。",
      "决定不必宏大；清晰、可践、属于您，就是好决定。",
    ],
  },
};

/** 未知 cardField 时的全局后备（己复用） */
const FALLBACK_GLOBAL =
  "用心觉察自我，安然面对日常点滴。";

/**
 * @param {string} seed 任务 id + 本次打开报告的 visit 种子
 * @returns {number} 0..SET_COUNT-1
 */
function pickSetIndexFromSeed(seed) {
  const h = String(seed || "");
  if (!h) return 0;
  let n = 0;
  for (let i = 0; i < h.length; i += 1) {
    n = (n + h.charCodeAt(i)) % SET_COUNT;
  }
  return n;
}

/**
 * 整份报告统一套系：同 task 同一次打开四象限均为甲/乙/…；换次打开 visitSeed 变则换套
 * @param {string} taskId
 * @param {string} [visitSeed]
 * @returns {number}
 */
function getReportFallbackSetIndex(taskId, visitSeed) {
  return pickSetIndexFromSeed(`${String(taskId || "").trim()}|${String(visitSeed || "")}`);
}

/** 套系名（调试/日志） */
const SET_NAMES = ["甲", "乙", "丙", "丁", "戊", "己"];

/**
 * @param {number} quadrantId
 * @param {string} cardField
 * @param {number} setIndex 0..5，整卷统一
 * @returns {string}
 */
function getFallbackCopyForCard(quadrantId, cardField, setIndex) {
  const q = Number(quadrantId);
  const field = String(cardField || "").trim();
  const byQ = FALLBACK_BY_QUADRANT_CARD[q];
  const list = byQ && byQ[field];
  if (!list || !list.length) return FALLBACK_GLOBAL;
  const idx = Math.abs(Number(setIndex)) % SET_COUNT;
  return list[idx] || list[0] || FALLBACK_GLOBAL;
}

/** 供云函数 isFallbackReply 对齐（与表内全文一致） */
function listAllFallbackLines() {
  const out = [FALLBACK_GLOBAL];
  Object.keys(FALLBACK_BY_QUADRANT_CARD).forEach((qKey) => {
    const byField = FALLBACK_BY_QUADRANT_CARD[qKey];
    Object.keys(byField).forEach((field) => {
      (byField[field] || []).forEach((line) => {
        const s = String(line || "").trim();
        if (s && out.indexOf(s) < 0) out.push(s);
      });
    });
  });
  return out;
}

module.exports = {
  SET_COUNT,
  SET_NAMES,
  FALLBACK_BY_QUADRANT_CARD,
  FALLBACK_GLOBAL,
  pickSetIndexFromSeed,
  getReportFallbackSetIndex,
  getFallbackCopyForCard,
  listAllFallbackLines,
};
