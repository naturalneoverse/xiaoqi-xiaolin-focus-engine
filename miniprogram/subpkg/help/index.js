const { requireLoginOnLoad } = require("../../utils/requireLogin");

Page({
  data: {
    guideList: [
      {
        title: "如何添加任务",
        content:
          "点击首页右上角 ⊕ 按钮，输入任务名称后，依次回答三个问题：轻重缓急、为谁而做、为何而做。保存后任务出现在首页列表中。若任务较大，可在「时间」页进入任务详情，点「+ 添加子任务」拆成小步（每个任务最多 20 条）；勾选完成会更新进度，子步骤全部完成后可将主任务标为已完成。",
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
          "哲思复盘绝非流水记录，而是一套可复用的心智成长框架。依托真实事件，帮您厘清现状、疏导内耗、定位课题、落地行动。向内觉察本心，摆脱外界干扰，活出自我节奏。专属解读化身觉察陪练全程相伴，助您做自己的内在专家，成为自己的人生掌舵者。在「时间」页打开任务详情（已取消的除外），点击「哲思复盘」，选一个象限方向按卡片如实填写。四个象限不必一次做完、也不必按顺序；但每个象限内须填完该象限全部题目再提交。提交后小麒小麟的回响在后台酝酿，约 1～3 分钟，建议等当前象限生成完成再开下一个。完成后在「我的 → 哲思复盘报告」查看。删除任务不会删掉已写复盘；若需删除某条，请在该列表长按记录。",
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
          "「我的」里的打卡记录：需在已登录的前提下，当日打开小程序即计为打卡一日；保存任务、身体记录或个人信息等同样会计入（自然日只计一次）。隔几天再打开也会累计，不要求连续。不可补签过往日期。「我的」显示累计打卡天数。累计满21天，生成真我海报时会有特别回响。",
      },
      {
        question: "如何删除任务？",
        answer:
          "在「时间」页任务列表长按任务卡片即可删除。哲思复盘会保留，可在「哲思复盘报告」查看或长按删除；若曾设日历提醒，请自行到手机「日历」删除相关条目。",
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
          "回响是小麒小麟根据您在该象限的作答生成的专属解读与呼应，不是标准答案。提交后通常在 1～3 分钟内在报告中可见。建议等选象限页「生成中」提示消失后再开下一个象限，回响更完整。若提示「回响生成未完成」，进入对应象限点「保存修改」即可（不用改字）。",
      },
      {
        question: "哲思复盘有哪些温馨提示？",
        answer:
          "① 象限之间：不必一次做完四个，选最有感觉的方向即可。② 象限之内：须填完本象限全部题目再提交（含手写、单选、多选及勾选项的展开说明）。③ 节奏：每保存一个象限后，等回响酝酿完成再填下一个。④ 保存与回响：手写提交即已保存；回响在后台生成，稍后再看报告即可。",
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
    faqOpen: [false, false, false, false, false, false, false, false, false, false, false, false, false, false],
    dataNotesList: [
      {
        question: "换手机或重装后，数据会自动回来吗？",
        answer:
          "登录同一微信后，任务、身体记录与哲思复盘作答会从云端拉取到本设备。若两台设备同时修改同一任务或同一象限，会提示您选择保留本机或云端版本。每日打卡等仍主要在本机。",
      },
      {
        question: "删除任务会删掉哲思复盘吗？",
        answer:
          "不会。删除任务只影响待办列表，已写的哲思复盘仍保留。请在「我的 → 哲思复盘报告」查看；若要删除某条复盘，请在该列表长按该记录。",
      },
      {
        question: "删任务后，日历提醒还会响吗？",
        answer:
          "可能会。提醒写入手机「日历」后，微信无法代您自动删除。若曾给任务设置过提醒，删除任务后请到手机「日历」App 中查找相关条目（描述含任务编号）并手动删除。",
      },
      {
        question: "个人资料、问卷标签存在哪里？",
        answer:
          "昵称、签名与头像会同步到云端，登录后在手机与电脑均可恢复。问卷标签在云端就绪时会同步；若仅存在本机或云未落库，换机后可能需重新填写。",
      },
      {
        question: "设置里的「清除缓存」会清什么？",
        answer:
          "只清除本机临时缓存，例如图片临时文件、哲思回响生成队列、界面提示计数等。不会清除任务、哲思记录、身体数据、打卡、个人资料与问卷标签；部分业务数据可在对应页面单独修改或删除。",
      },
    ],
    dataNotesOpen: [false, false, false, false, false],
  },

  onLoad() {
    if (!requireLoginOnLoad()) return;
  },

  goBrandIntro() {
    const { openBrandIntro } = require("../../utils/brandIntroNavigate");
    openBrandIntro({ from: "help" });
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

  toggleDataNote(e) {
    const { index } = e.currentTarget.dataset;
    const idx = Number(index);
    const len = this.data.dataNotesList.length;
    const next = new Array(len).fill(false);
    next[idx] = !this.data.dataNotesOpen[idx];
    this.setData({
      dataNotesOpen: next,
    });
  },
});
