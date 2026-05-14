const STORAGE_KEYS = require("../../config/storageKeys");
const { requireLoginOnLoad } = require("../../utils/requireLogin");
const { GENDER_OPTIONS, LIFE_STAGE_OPTIONS, ROLE_OPTIONS } = require("../../config/userTags");
const { goSleepHome } = require("../../utils/goTabHome");

/** 云函数未部署 / 环境未连上 / -501 等基础设施错误 */
function isCloudInfraError(err, result) {
  const msg = `${(err && (err.errMsg || err.message)) || ""} ${(result && result.errMsg) || ""}`;
  return /-501|-502|503|504|FUNCTION|云函数|function not|Environment|timeout|超时|network|fail connect/i.test(msg);
}

function saveTagsLocalAndMarkDone(app, gender, lifeStage, roles) {
  try {
    wx.setStorageSync(STORAGE_KEYS.USER_TAGS_LOCAL, {
      gender,
      lifeStage,
      roles,
      savedAt: Date.now(),
    });
    wx.setStorageSync(STORAGE_KEYS.USER_TAGS_COMPLETE, true);
  } catch (e) {
    console.warn("saveTagsLocal", e);
  }
  if (app && app.globalData) {
    app.globalData.userTagsComplete = true;
  }
}

Page({
  data: {
    genderOptions: GENDER_OPTIONS,
    lifeStageOptions: LIFE_STAGE_OPTIONS,
    roleOptions: ROLE_OPTIONS,
    gender: "",
    lifeStage: "",
    roles: [],
    canSubmit: false,
    submitting: false,
  },

  onLoad() {
    if (!requireLoginOnLoad()) return;
    const app = getApp();
    if (!app || !app.globalData) {
      wx.reLaunch({ url: "/pages/login/index" });
      return;
    }
    if (app.globalData.userTagsComplete === true) {
      goSleepHome();
      return;
    }
    if (!wx.cloud) {
      return;
    }
    wx.cloud
      .callFunction({
        name: "quickstartFunctions",
        data: { type: "getUserTags" },
      })
      .then((res) => {
        const r = (res && res.result) || {};
        if (r.success && r.tagsComplete) {
          app.globalData.userTagsComplete = true;
          try {
            wx.setStorageSync(STORAGE_KEYS.USER_TAGS_COMPLETE, true);
          } catch (e) {
            /* ignore */
          }
          goSleepHome();
        }
      })
      .catch(() => {});
  },

  recompute() {
    const { gender, lifeStage, roles } = this.data;
    const canSubmit = !!(gender && lifeStage && roles.length >= 2);
    if (canSubmit !== this.data.canSubmit) {
      this.setData({ canSubmit });
    }
  },

  onPickGender(e) {
    const id = e.currentTarget.dataset.id;
    this.setData({ gender: id });
    this.recompute();
  },

  onPickStage(e) {
    const id = e.currentTarget.dataset.id;
    this.setData({ lifeStage: id });
    this.recompute();
  },

  onToggleRole(e) {
    const id = e.currentTarget.dataset.id;
    const roles = (this.data.roles || []).slice();
    const i = roles.indexOf(id);
    if (i >= 0) {
      roles.splice(i, 1);
    } else {
      roles.push(id);
    }
    this.setData({ roles });
    this.recompute();
  },

  async onSubmit() {
    if (!this.data.canSubmit || this.data.submitting) return;
    const app = getApp();
    const { gender, lifeStage, roles } = this.data;
    if (!wx.cloud) {
      saveTagsLocalAndMarkDone(app, gender, lifeStage, roles);
      wx.showToast({ title: "已本机保存，可继续使用", icon: "none" });
      setTimeout(() => goSleepHome(), 320);
      return;
    }
    this.setData({ submitting: true });
    try {
      const cf = await wx.cloud.callFunction({
        name: "quickstartFunctions",
        data: {
          type: "saveUserTags",
          gender,
          lifeStage,
          roles,
        },
      });
      const r = (cf && cf.result) || {};
      if (r.success) {
        if (app && app.globalData) {
          app.globalData.userTagsComplete = true;
        }
        try {
          wx.setStorageSync(STORAGE_KEYS.USER_TAGS_COMPLETE, true);
          wx.removeStorageSync(STORAGE_KEYS.USER_TAGS_LOCAL);
        } catch (e) {
          /* ignore */
        }
        wx.showToast({ title: "欢迎进入", icon: "success" });
        setTimeout(() => goSleepHome(), 450);
        return;
      }
      if (isCloudInfraError(null, r) || /collection|database|Db|不存在/i.test(r.errMsg || "")) {
        saveTagsLocalAndMarkDone(app, gender, lifeStage, roles);
        wx.showToast({
          title: "云端未就绪，已暂存本机；部署云后可换机同步",
          icon: "none",
          duration: 3200,
        });
        setTimeout(() => {
          goSleepHome();
        }, 400);
        return;
      }
      wx.showToast({
        title: r.errMsg || "保存失败",
        icon: "none",
      });
    } catch (e) {
      console.error("saveUserTags", e);
      if (isCloudInfraError(e, null)) {
        saveTagsLocalAndMarkDone(app, gender, lifeStage, roles);
        wx.showToast({
          title: "云端未就绪，已暂存本机；部署云后可换机同步",
          icon: "none",
          duration: 3200,
        });
        setTimeout(() => {
          goSleepHome();
        }, 400);
        return;
      }
      wx.showToast({
        title: (e && (e.errMsg || e.message)) || "保存失败，请重试",
        icon: "none",
      });
    } finally {
      this.setData({ submitting: false });
    }
  },
});
