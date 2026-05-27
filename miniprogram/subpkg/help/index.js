Page({
  data: {
    guideList: [
      {
        title: "如何添加任务",
        content:
          "点击首页右上角 ⊕ 按钮，输入任务名称后，依次回答三个问题：轻重缓急、为谁而做、为何而做。保存后任务出现在首页列表中。",
      },
      {
        title: "如何查看时间编织图",
        content:
          "每周一早上，系统自动生成您的专属时间编织图。点击首页底部「时间编织图」卡片即可查看。包含时间流向图（期待/当下/保留）和意义构成图（生计/职责/真我），帮您看见这一周的时间质地。",
      },
      {
        title: "如何记录身体边界",
        content:
          "点击底部导航「身心」，进入身心页面。点击「身体」卡片，回答三个问题：今天睡得怎么样、动得怎么样、身体怎么样。提交后数据自动保存，每周可查看身体边界报告。",
      },
      {
        title: "如何进行哲思复盘",
        content:
          "哲思复盘绝非流水记录，而是一套可复用的心智成长框架。依托真实事件，帮您厘清现状、疏导内耗、定位课题、落地行动。向内觉察本心，摆脱外界干扰，活出自我节奏。专属解读化身觉察陪练全程相伴，助您做自己的内在专家，成为自己的人生掌舵者。在「时间」页打开任务详情（已取消的除外），点击「哲思复盘」，选一个象限方向按卡片如实填写即可，不必一次做完；提交后回响约半分钟内生成，生成中可先填其它象限。完成后可在本页或「我的 → 哲思复盘报告」查看。删除任务不会删掉已写复盘；若需删除某条，请在该列表长按记录。",
      },
    ],
    guideOpen: [false, false, false, false],
    faqList: [
      {
        question: "真我时刻怎么算的？",
        answer:
          "本周仍在清单里的每条任务（含进行中和已完成、延期）按标签计分：真我+1、不二+3、合一+3，生计和职责不计分。分值可叠加，1分=1次。",
      },
      {
        question: "怎么修改昵称和签名？",
        answer:
          "点击「我的」页面顶部的头像区域，进入编辑个人信息页面，修改昵称和签名后点击「保存」即可。",
      },
      {
        question: "任务标签可以修改吗？",
        answer:
          "任务创建后，标签不可修改。建议删除后重新添加任务，再次选择正确的标签。",
      },
      {
        question: "身体边界记录怎么补录？",
        answer:
          "目前身体边界记录仅支持当周记录，不支持补录过往周数据。每周日系统会发送提醒，记得按时记录哦。",
      },
      {
        question: "时间编织图什么时候生成？",
        answer:
          "每周一早上自动生成上一周的时间编织图。需要当周至少添加过1个任务并完成至少1次标签标记。",
      },
      {
        question: "打卡中断了能补吗？",
        answer:
          "「我的」里的打卡记录：需在已登录的前提下，当日至少保存过一次任务、身体记录或个人信息等，自然日内计为打卡一日，同一天多次保存也只计一次；不可补签过往日期。连续天数从今天往前数自然连续有打卡的日子，中断后重新计算。坚持21天会有惊喜哦。",
      },
      {
        question: "如何删除任务？",
        answer: "在时间首页的任务列表里，长按任意任务卡片即可删除该任务。",
      },
      {
        question: "如何更改任务状态？",
        answer:
          "点击任务卡片进入详情页。在这里，您可以将任务标记为「进行中」「已完成」「已取消」或「已延期」。",
      },
      {
        question: "四个象限分别做什么？",
        answer:
          "观实归真：放下预设，看见真实经过。观心明己：在困境里听见自己的情绪与在意。自我主宰：分清「我的课题」与「别人的课题」，找回节奏。踏实前行：从看见到行动，定下最小一步。不必按顺序完成，选当下最有感觉的方向即可。",
      },
      {
        question: "一定要做完四个象限吗？",
        answer:
          "不必。完成一两个象限也有价值；四象限都完成后，报告更完整。未做完的会出现在「哲思复盘报告」的「进行中」，您可随时续写。",
      },
      {
        question: "小麒小麟的「回响」是什么？要等多久？",
        answer:
          "回响是小麒小麟根据您在该象限的作答生成的专属解读与呼应，不是标准答案。提交后通常约半分钟内在报告中可见；若仍显示生成中，可先填写其它象限，稍后再打开报告查看。",
      },
      {
        question: "删除任务会删掉哲思复盘吗？",
        answer:
          "不会。删除任务只影响待办列表，已写的哲思复盘仍在「我的 → 哲思复盘报告」中查看。",
      },
      {
        question: "如何删除某条哲思复盘？",
        answer:
          "在「我的 → 哲思复盘报告」中长按该条记录，确认后即可删除；此操作不可恢复，与是否删除任务无关。",
      },
    ],
    faqOpen: [false, false, false, false, false, false, false, false, false, false, false, false, false],
  },

  onLoad() {
    const { requireLoginOnLoad } = require("../../utils/requireLogin");
    if (!requireLoginOnLoad()) return;
  },

  toggleGuide(e) {
    const { index } = e.currentTarget.dataset;
    const idx = Number(index);
    const len = this.data.guideList.length;
    const next = new Array(len).fill(false);
    next[idx] = !this.data.guideOpen[idx];
    this.setData({
      guideOpen: next,
    });
  },

  toggleFaq(e) {
    const { index } = e.currentTarget.dataset;
    const idx = Number(index);
    const len = this.data.faqList.length;
    const next = new Array(len).fill(false);
    next[idx] = !this.data.faqOpen[idx];
    this.setData({
      faqOpen: next,
    });
  },
});
