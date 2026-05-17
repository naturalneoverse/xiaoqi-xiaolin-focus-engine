/** 已完成的温馨提示次数（0→1→2→3，≥3 不再弹） */
const STORAGE_COUNT = "calendar_notice_guide_shown_count";
/** 第三次勾选「不再提示」后永久不再弹 */
const STORAGE_NEVER = "calendar_notice_guide_never_again";

const CALENDAR_NOTIFY_MODAL_TEXT =
  "小麒说：记得开启日历通知权限，才不会错过重要提醒哦～";

/** 防止同一流程内连续两次触发（例如双 tap）叠出两个温馨提示 */
let calendarGuideUiBusy = false;

function releaseCalendarGuideUiBusy() {
  calendarGuideUiBusy = false;
}

function getCount() {
  try {
    const v = wx.getStorageSync(STORAGE_COUNT);
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch (e) {
    return 0;
  }
}

function setCount(n) {
  try {
    wx.setStorageSync(STORAGE_COUNT, n);
  } catch (e) {
    /* ignore */
  }
}

function getNever() {
  try {
    return !!wx.getStorageSync(STORAGE_NEVER);
  } catch (e) {
    return false;
  }
}

function setNever() {
  try {
    wx.setStorageSync(STORAGE_NEVER, true);
  } catch (e) {
    /* ignore */
  }
}

/**
 * 第三次弹窗关闭时调用：勾选则永久沉默；无论是否勾选，次数记满不再出现第 4 次。
 * @param {{ neverAgain?: boolean }} opts
 */
function markThirdGuideClosed(opts) {
  const never = !!(opts && opts.neverAgain);
  if (never) setNever();
  setCount(3);
}

function showSimpleGuideModal() {
  wx.showModal({
    title: "温馨提示",
    content: CALENDAR_NOTIFY_MODAL_TEXT,
    showCancel: false,
    confirmText: "知道了",
    complete: () => {
      releaseCalendarGuideUiBusy();
      setCount(getCount() + 1);
    },
  });
}

function showThirdGuideFallback() {
  let closed = false;
  const finish = (neverAgain) => {
    if (closed) return;
    closed = true;
    markThirdGuideClosed({ neverAgain: !!neverAgain });
  };
  wx.showModal({
    title: "温馨提示",
    content: `${CALENDAR_NOTIFY_MODAL_TEXT}\n\n此为最后一次提醒。`,
    showCancel: true,
    cancelText: "不再提示",
    confirmText: "知道了",
    success(res) {
      if (res && res.cancel) finish(true);
      else finish(false);
    },
    fail: () => finish(false),
    complete: () => {
      releaseCalendarGuideUiBusy();
    },
  });
}

/**
 * 在系统日历已成功写入日程后调用：前 2 次纯温馨提示；第 3 次带「不再提示」复选框（无组件时降级为双按钮）；之后永不弹。
 */
function showCalendarNotifyGuideModal() {
  try {
    if (getNever()) return;
    if (calendarGuideUiBusy) return;
    const c = getCount();
    if (c >= 3) return;

    if (c < 2) {
      calendarGuideUiBusy = true;
      showSimpleGuideModal();
      return;
    }

    calendarGuideUiBusy = true;
    const pages = getCurrentPages();
    const cur = pages && pages.length ? pages[pages.length - 1] : null;
    if (cur && typeof cur.selectComponent === "function") {
      const comp = cur.selectComponent("#calendar-guide-dialog");
      if (comp && typeof comp.open === "function") {
        comp.open();
        return;
      }
    }
    showThirdGuideFallback();
  } catch (e) {
    releaseCalendarGuideUiBusy();
  }
}

module.exports = {
  showCalendarNotifyGuideModal,
  markThirdGuideClosed,
  releaseCalendarGuideUiBusy,
  CALENDAR_NOTIFY_MODAL_TEXT,
};
