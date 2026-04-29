Component({
  data: {
    selected: 0,
    list: [
      {
        pagePath: "/pages/sleep/index",
        text: "时间",
        iconPath: "/images/transparent background/tab-time.png",
        selectedIconPath: "/images/transparent background/tab-time-active.png",
      },
      {
        pagePath: "/pages/index/index",
        text: "身心",
        iconPath: "/images/transparent background/tab-mind.png",
        selectedIconPath: "/images/transparent background/tab-mind-active.png",
      },
      {
        pagePath: "/pages/my/index",
        text: "我的",
        iconPath: "/images/transparent background/tab-me.png",
        selectedIconPath: "/images/transparent background/tab-me-active.png",
      },
    ],
  },
  methods: {
    switchTab(e) {
      const index = e.currentTarget.dataset.index;
      const url = this.data.list[index].pagePath;
      this.setData({ selected: index });
      wx.switchTab({ url });
    },
  },
});
