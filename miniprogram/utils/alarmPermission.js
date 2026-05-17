/**
 * 微信闹钟相关授权：通过 wx.getSetting / wx.openSetting 处理 scope.alarmClock。
 * 若运行环境未返回该 scope（低版本客户端），视为无需前置拦截，返回 true 交由上层尝试 wx.setAlarmClock。
 */

const SCOPE_ALARM = "scope.alarmClock";

function toast(title) {
  const t = (title && String(title).trim()) || "操作失败";
  try {
    wx.showToast({ title: t.length > 20 ? `${t.slice(0, 20)}…` : t, icon: "none" });
  } catch (e) {
    /* ignore */
  }
}

function readAuth(res) {
  return res && res.authSetting && typeof res.authSetting === "object" ? res.authSetting : {};
}

/**
 * @returns {Promise<boolean>} 已授权或当前环境不暴露该 scope 时为 true；明确拒绝且重试后仍无权限为 false
 */
function ensureAlarmPermission() {
  return new Promise((resolve) => {
    try {
      if (typeof wx.getSetting !== "function") {
        resolve(false);
        return;
      }
      wx.getSetting({
        success: (res) => {
          try {
            const auth = readAuth(res);
            if (!Object.prototype.hasOwnProperty.call(auth, SCOPE_ALARM)) {
              resolve(true);
              return;
            }
            if (auth[SCOPE_ALARM] === true) {
              resolve(true);
              return;
            }
            if (typeof wx.openSetting !== "function") {
              toast("无法打开设置");
              resolve(false);
              return;
            }
            wx.openSetting({
              success: (res2) => {
                try {
                  const auth2 = readAuth(res2);
                  if (auth2[SCOPE_ALARM] === true) {
                    resolve(true);
                    return;
                  }
                  toast("未开启闹钟权限，可到微信或系统设置中手动开启");
                  resolve(false);
                } catch (e2) {
                  resolve(false);
                }
              },
              fail: () => {
                toast("打开设置失败");
                resolve(false);
              },
            });
          } catch (e) {
            resolve(false);
          }
        },
        fail: () => {
          resolve(false);
        },
      });
    } catch (e) {
      resolve(false);
    }
  });
}

/** 系统日历（带提醒），与 wx.addPhoneCalendar 对应 */
const SCOPE_ADD_PHONE_CALENDAR = "scope.addPhoneCalendar";

function openSettingThen(resolve, scopeKey, deniedToast) {
  if (typeof wx.openSetting !== "function") {
    toast("无法打开设置");
    resolve(false);
    return;
  }
  wx.openSetting({
    success: (res2) => {
      try {
        const auth2 = readAuth(res2);
        if (auth2[scopeKey] === true) {
          resolve(true);
          return;
        }
        toast(deniedToast);
        resolve(false);
      } catch (e2) {
        resolve(false);
      }
    },
    fail: () => {
      toast("打开设置失败");
      resolve(false);
    },
  });
}

/**
 * wx.addPhoneCalendar 所需 scope.addPhoneCalendar：未询问时先 authorize，失败再 openSetting。
 * @returns {Promise<boolean>}
 */
function ensureAddPhoneCalendarPermission() {
  return new Promise((resolve) => {
    try {
      if (typeof wx.getSetting !== "function") {
        resolve(false);
        return;
      }
      wx.getSetting({
        success: (res) => {
          try {
            const auth = readAuth(res);
            if (auth[SCOPE_ADD_PHONE_CALENDAR] === true) {
              resolve(true);
              return;
            }
            if (auth[SCOPE_ADD_PHONE_CALENDAR] === false) {
              openSettingThen(resolve, SCOPE_ADD_PHONE_CALENDAR, "需要开启日历权限才能添加提醒");
              return;
            }
            if (typeof wx.authorize === "function") {
              wx.authorize({
                scope: SCOPE_ADD_PHONE_CALENDAR,
                success: () => resolve(true),
                fail: () => {
                  openSettingThen(resolve, SCOPE_ADD_PHONE_CALENDAR, "需要开启日历权限才能添加提醒");
                },
              });
            } else {
              openSettingThen(resolve, SCOPE_ADD_PHONE_CALENDAR, "需要开启日历权限才能添加提醒");
            }
          } catch (e) {
            resolve(false);
          }
        },
        fail: () => resolve(false),
      });
    } catch (e) {
      resolve(false);
    }
  });
}

module.exports = {
  ensureAlarmPermission,
  ensureAddPhoneCalendarPermission,
  SCOPE_ALARM,
  SCOPE_ADD_PHONE_CALENDAR,
};
