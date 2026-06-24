/**
 * 品牌引导页视口：按手机窗口计算全屏与各层安全区
 */

const theme = require("../config/brandIntroTheme");

function readViewport() {
  let wi = {};
  try {
    wi = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
  } catch (e) {
    wi = {};
  }
  const w = Number(wi.windowWidth || wi.screenWidth) || 375;
  const h = Number(wi.windowHeight || wi.screenHeight) || 812;
  const safe = wi.safeArea || {};
  const safeTop = Number(safe.top != null ? safe.top : wi.statusBarHeight) || 0;
  const safeBottom = Math.max(0, h - (Number(safe.bottom) || h));

  const ui = theme.UI || {};
  const textTopPx = Math.round(h * (ui.textTopRatio != null ? ui.textTopRatio : 0.14));
  const textBottomPx = Math.round(h * (ui.textBottomRatio != null ? ui.textBottomRatio : 0.5));
  const skipBottomPx = safeBottom + 20;
  const navBottomPx = safeBottom + Math.round(h * 0.157);
  const ctaBarBottomPx = skipBottomPx + 36;
  const ctaHeightPx = Math.round((88 / 750) * w);
  const navBottomWithCtaPx = ctaBarBottomPx + ctaHeightPx + 28;

  return {
    w,
    h,
    safeTop,
    safeBottom,
    pageStyle: `width:${w}px;height:${h}px;`,
    textZoneStyle: `top:${textTopPx}px;bottom:${textBottomPx}px;`,
    introNavStyle: `bottom:${navBottomPx}px;`,
    introNavCtaStyle: `bottom:${navBottomWithCtaPx}px;`,
    introSkipStyle: `bottom:${skipBottomPx}px;`,
    introCtaFooterStyle: `bottom:${ctaBarBottomPx}px;`,
  };
}

module.exports = {
  readViewport,
};
