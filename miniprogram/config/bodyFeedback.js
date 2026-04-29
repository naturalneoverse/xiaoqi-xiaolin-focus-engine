/**
 * Body Feedback Config
 *
 * 可改字段（你本地只改这些即可）：
 * 1) BODY_PHRASES / SLEEP_PHRASES / SPORT_PHRASES
 *    - 即时反馈短句词库（today-report 三合一单句会读取这里）
 * 2) SCORE_MAP
 *    - 周报分值映射（睡眠/运动/身体信号）
 * 3) WEEK_STATUS_RULES
 *    - 周均分区间与状态文案（title/desc）
 * 4) WEEK_CARE_TEXT
 *    - 周报贴心一句文案
 *
 * 不建议改动：
 * - buildInstantFeedback / getRecordScore / getWeekStatus 函数名与入参
 * - module.exports 导出字段名
 *
 * 说明：
 * - 文案建议不加 emoji，保持简短温柔风格
 * - 修改后重新编译小程序即可生效
 */
const BODY_PHRASES = {
  累了: "有点累",
  疼了: "有点不适",
  没事: "状态平稳",
  有劲: "状态在线",
};

const SLEEP_PHRASES = {
  睡得香: "睡得还不错",
  做梦了: "梦有点多",
  睡不实: "睡得有点浅",
  睡不着: "入睡不太顺",
};

const SPORT_PHRASES = {
  动够了: "今天先放松就好",
  动了点: "这样就很好",
  没咋动: "晚点散几分钟步",
  动过头了: "明天记得缓一缓",
};

const SCORE_MAP = {
  sleep: {
    睡得香: 40,
    做梦了: 30,
    睡不实: 20,
    睡不着: 10,
  },
  sport: {
    动够了: 40,
    动了点: 30,
    没咋动: 20,
    动过头了: 10,
  },
  signal: {
    没事: 40,
    有劲: 40,
    累了: 20,
    疼了: 10,
  },
};

const WEEK_STATUS_RULES = [
  {
    min: 100,
    max: 120,
    title: "身心满格",
    desc: "这周你把自己照顾得很好。睡得好、动得开、身体也舒坦，这就是最好的状态。",
  },
  {
    min: 70,
    max: 99,
    title: "状态平稳",
    desc: "整体不错，某方面再加点力就更好了。是睡眠？还是运动？你看看数据就知道。",
  },
  {
    min: 40,
    max: 69,
    title: "轻微失衡",
    desc: "身体在给你一些提醒了。这周可能有些累，别硬撑，下周多留点时间给自己。",
  },
  {
    min: 10,
    max: 39,
    title: "需要调整",
    desc: "这周辛苦了。身体一直在喊你，听见了没？下周从睡个好觉开始，慢慢来。",
  },
];

const WEEK_CARE_TEXT = {
  sleepWorst: "这周有几晚没睡好。没事，下周早点躺下，哪怕多睡一小会儿。",
  sportLeast: "这周动得少了一点。下周散个步就行，不追求多，只追求动。",
  signalWorst: "身体在提醒你慢一点。下周试试：累了就歇，疼了就停，别硬扛。",
  overallGood: "这周身体和你配合得很好，继续保持这个节奏，你对自己挺好的。",
};

function buildInstantFeedback(payload) {
  const body = BODY_PHRASES[payload.signal] || "状态还在调整";
  const sleep = SLEEP_PHRASES[payload.sleep] || "睡眠节奏慢慢找回";
  const sport = SPORT_PHRASES[payload.sport] || "先照顾好自己";
  return `你今天${body}，${sleep}；${sport}。`;
}

function getRecordScore(record) {
  return (
    (SCORE_MAP.sleep[record.sleep] || 0) +
    (SCORE_MAP.sport[record.sport] || 0) +
    (SCORE_MAP.signal[record.signal] || 0)
  );
}

function getWeekStatus(averageScore) {
  return (
    WEEK_STATUS_RULES.find((rule) => averageScore >= rule.min && averageScore <= rule.max) || WEEK_STATUS_RULES[3]
  );
}

module.exports = {
  SCORE_MAP,
  WEEK_STATUS_RULES,
  WEEK_CARE_TEXT,
  buildInstantFeedback,
  getRecordScore,
  getWeekStatus,
};
