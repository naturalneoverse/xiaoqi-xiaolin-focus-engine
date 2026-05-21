/**
 * 复盘报告叙事规则 humorous_v1_with_original（与产品 PRD JSON 对齐，供 narrative 引用）
 * 字段名与 cardResponses 下标以 reflectionQuadrantCards 为准。
 */

const SHORT_TH = 10;
const LONG_TH = 50;

const REPORT_COMBO_INTRO = "说实话，下面这些比哲学书好看\n——因为是您写的。";
const REPORT_COMBO_OUTRO = "——小麟 & 小麒，溜了溜了";

const QUADRANT_1 = {
  single_choice_mapping: {
    full: "全心投入，忘了时间",
    routine: "按部就班，没什么特别",
    distracted: "有点分心，不太专注",
    forced: "硬撑完成，其实不想做",
  },
  output_by_choice: {
    full: "您全身心投入了。这种状态很珍贵，它叫心流。",
    routine: "平平淡淡也是真。不是每一天都要轰轰烈烈。",
    distracted: "分心很正常。重要的是您回来了。",
    forced: "您把它做完了。不管过程怎样，完成本身就有分量。",
  },
  echo_by_choice: {
    full: "『投入本身，就是回报。』",
    routine: "『日常，也是修行。』",
    distracted: "『回来，就是胜利。』",
    forced: "『完成，比完美更诚实。』",
  },
  statistics_humorous:
    "您刚才记录了自己和预期的关系。其实人就是这样——先有判断再去看事实，记忆会自己偷偷改剧本，偏差能涨37%。您至少诚实地记下了真实感受，没骗自己。",
};

const QUADRANT_2 = {
  output_by_card: {
    card0:
      "您承认了自己卡住。说真的，这比假装没事强一百倍。『卡住，说明您在意。不在意的事，卡不住您。』",
    card1: "您追问了：这份卡顿里，我到底在乎什么？『您在乎的地方，就是答案藏的地方。』",
    card2: "您问了个很猛的问题：如果这是生命在练我，它在练什么？『困境不是惩罚，是私教课。』",
  },
  length_short: "行，您留了个记号。『一句话，够了。』",
  length_long: "写了这么多，您是认真的。『认真的人，运气都不差。』",
  /** 关键词顺序即匹配优先级（只取第一条） */
  emotion_keywords: [
    ["累|疲惫|无力|撑不住", "累了就歇，哲学不罚站。『承认累，比硬撑高级。』"],
    ["迷茫|不知道|困惑|搞不懂", "迷茫啊，正常。哲学家也迷茫，只是他们说得更好听。『困惑不是bug，是feature。』"],
    ["开心|感谢|温暖|庆幸", "诶，这个好，记住它。『开心不常有，有了就存档。』"],
    ["焦虑|担心|害怕|慌", "焦虑是大脑在试图保护您。但它有时候太用力了。『担心的事，90%不会发生。』"],
    ["生气|愤怒|不爽|烦", "生气是边界被触碰的信号。不是坏事，但别让它加班。『愤怒，是最诚实的情绪。』"],
    ["委屈|难过|伤心|想哭", "委屈说明您在意。在意的人，心是软的，不是弱的。『难过不是矫情，是心里有事。』"],
    ["孤独|一个人|没人懂", "孤独不是没人陪，是此刻没人刚好懂您。『孤独，是灵魂在换季。』"],
    ["压力大|喘不过气|好难", "压力是您在扛事。扛不动的时候，放下也是本事。『压力不是您不强，是您太认真。』"],
    ["后悔|早知道|如果当初", "后悔是现在的您，在替过去的您复盘。它有用，但别住那儿。『后悔是最好的老师，也是最差的室友。』"],
    ["麻木|没感觉|无所谓", "麻木是情绪在休假。不急，它会回来的。『没感觉，有时候也是一种保护。』"],
  ],
};

const QUADRANT_3 = {
  single_choice_mapping: {
    mostly: "有，很大程度是为了被认可",
    somewhat: "有一点，但不完全是",
    none: "没有，纯粹为自己",
  },
  output_by_choice: {
    mostly: "您看见了「被认可」这个念头。看见，就是选择权的开始。",
    somewhat: "一半为别人，一半为自己。这个比例很人间真实。",
    none: "您很清楚自己在做什么。这是难得的清醒。",
  },
  echo_by_choice: {
    mostly: "『被看见，是需求；被自己看见，是能力。』",
    somewhat: "『平衡，是成年人的基本功。』",
    none: "『自己，才是最终的回答者。』",
  },
  statistics_humorous:
    "您刚才区分了哪些是自己的事、哪些是别人的。研究说，常做这种区分的人，幸福感能高42%，后悔也少一半。这笔账，划算。",
};

const QUADRANT_4 = {
  output_by_selection: {
    has_experience: "您想带走一个经验。经验不是负担，是走过的证据。",
    has_feeling: "您想带走一个感受。感受是当下最真实的坐标。",
    has_decision: "您想带走一个决定。决定，是改变的第一帧。",
    only_nothing: "您选择什么都不带走。不带走，也是一种诚实。有些事，不需要总结。",
    mixed: "您挑了几样带走。不用全带走，带走一个就够了。",
  },
  echo_by_selection: {
    has_experience: "『经验，是走过的证明。』",
    has_feeling: "『感受，是活着的证据。』",
    has_decision: "『决定，是改变的开始。』",
    only_nothing: "『停留，不是放弃，是尊重自己的节奏。』",
    mixed: "『您不必带走全部，带走一个就够。』",
  },
  experience_long_th: 30,
  experience_long_style: "这个经验您写得很细。认真的人，运气都不差。",
  feeling_decision_long_th: 20,
  feeling_decision_long_style: "您写得不多，但每个字都算数。",
};

const GENERAL_SUMMARY = {
  part_1: "看见事实 → 听见自己 → 分清边界 → 迈出一小步",
  part_2: "这不是答案，而是一套您可以反复使用的心智框架。",
  part_3: "『人的成长，不是消除困惑，而是学会和重要的问题相处。』",
};

const FALLBACK_NO_ANSWER = "啥也没写？那就不生成，不打扰。";

module.exports = {
  SHORT_TH,
  LONG_TH,
  REPORT_COMBO_INTRO,
  REPORT_COMBO_OUTRO,
  QUADRANT_1,
  QUADRANT_2,
  QUADRANT_3,
  QUADRANT_4,
  GENERAL_SUMMARY,
  FALLBACK_NO_ANSWER,
};
