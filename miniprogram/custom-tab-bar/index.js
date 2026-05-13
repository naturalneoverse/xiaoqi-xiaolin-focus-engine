Component({
  data: {
    selected: 0,
    list: [
      {
        pagePath: "pages/sleep/index",
        text: "时间",
        iconPath: "/images/transparent background/tab-time.png",
        selectedIconPath: "/images/transparent background/tab-time-active.png",
      },
      {
        pagePath: "pages/index/index",
        text: "身心",
        iconPath: "/images/transparent background/tab-mind.png",
        selectedIconPath: "/images/transparent background/tab-mind-active.png",
      },
      {
        pagePath: "pages/my/index",
        text: "我的",
        iconPath: "/images/transparent background/tab-me.png",
        selectedIconPath: "/images/transparent background/tab-me-active.png",
      },
    ],
  },
  methods: {
    onImageError(e) {
      const index = Number(e.currentTarget.dataset.index);
      if (!Number.isInteger(index) || index < 0 || index >= this.data.list.length) return;
      const list = this.data.list.slice();
      list[index] = {
        ...list[index],
        iconPath: "/images/transparent background/avatar.png",
        selectedIconPath: "/images/transparent background/avatar.png",
      };
      this.setData({ list });
    },
    switchTab(e) {
      const index = e.currentTarget.dataset.index;
      const path = this.data.list[index].pagePath;
      this.setData({ selected: index });
      wx.switchTab({
        url: path,
        fail: (err) => {
          console.warn("[custom-tab-bar] switchTab fail, retry with slash", path, err);
          wx.switchTab({ url: path.startsWith("/") ? path : `/${path}` });
        },
      });
    },
  },
});
