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
          "每周一早上，系统自动生成您的专属时间编织图。点击首页底部'时间编织图'卡片即可查看。包含时间流向图（期待/当下/保留）和意义构成图（生计/职责/真我），帮您看见这一周的时间质地。",
      },
      {
        title: "如何记录身体边界",
        content:
          "点击底部导航'身心'，进入身心页面。点击'身体'卡片，回答三个问题：今天睡得怎么样、动得怎么样、身体怎么样。提交后数据自动保存，每周可查看身体边界报告。",
      },
    ],
    guideOpen: [false, false, false],
    faqList: [
      {
        question: "怎么修改昵称和签名？",
        answer:
          "点击'我的'页面顶部的头像区域，进入编辑个人信息页面，修改昵称和签名后点击右上角'保存'即可。",
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
          "目前打卡记录不可补签。连续打卡天数为自然连续天数，中断后重新开始计算。坚持21天会有惊喜哦。",
      },
    ],
    faqOpen: [false, false, false, false, false],
  },

  toggleGuide(e) {
    const { index } = e.currentTarget.dataset;
    const idx = Number(index);
    const next = [false, false, false];
    next[idx] = !this.data.guideOpen[idx];
    this.setData({
      guideOpen: next,
    });
  },

  toggleFaq(e) {
    const { index } = e.currentTarget.dataset;
    const idx = Number(index);
    const next = [false, false, false, false, false];
    next[idx] = !this.data.faqOpen[idx];
    this.setData({
      faqOpen: next,
    });
  },

  goBack() {
    this.closeToMy();
  },

  goHome() {
    this.closeToMy();
  },

  closeToMy() {
    const pages = getCurrentPages();
    const targetRoute = "pages/my/index";
    const targetIndex = pages.findIndex((page) => page.route === targetRoute);

    if (targetIndex >= 0) {
      const delta = pages.length - targetIndex - 1;
      if (delta > 0) {
        wx.navigateBack({ delta });
        return;
      }
    }

    wx.switchTab({
      url: "/pages/my/index",
    });
  },
});
