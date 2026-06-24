const theme = require("../../config/brandIntroTheme");
const bgAssets = require("./backgrounds");
const { readViewport } = require("../../utils/brandIntroLayout");
const {
  startBrandIntroDissolve,
  calcDissolveCanvasHeight,
  calcLineMetrics,
} = require("../../utils/brandIntroDissolve");
const {
  markBrandIntroSeen,
  markBrandIntroSessionDismissed,
} = require("../../utils/brandIntroNavigate");

Page({
  data: {
    viewport: {
      w: 375,
      h: 812,
      safeTop: 0,
      safeBottom: 0,
      pageStyle: "",
      textZoneStyle: "",
      introNavStyle: "bottom:128px;",
      introNavCtaStyle: "bottom:160px;",
      introSkipStyle: "bottom:20px;",
      introCtaFooterStyle: "bottom:56px;",
    },
    skyGradientCss: theme.SKY_GRADIENT_CSS,
    bgAct: 1,
    bgPath: bgAssets.bgPathForAct(1),
    bgImageVisible: false,
    bgUseFallback: false,
    stepIndex: 0,
    lineText: "",
    lineAnim: "",
    lineStackH: 80,
    dissolveActive: false,
    dissolveHideText: false,
    dissolveCanvasVisible: false,
    dissolveCanvasW: 300,
    dissolveCanvasH: 80,
    showCta: false,
    progressDots: theme.BRAND_INTRO_STEPS.map((_, i) => i),
    hintText: theme.HINT_TEXT,
    skipText: theme.SKIP_TEXT,
    ctaText: theme.CTA_TEXT,
  },

  _from: "",
  _resizeHandler: null,
  _advancing: false,
  _dissolveRun: null,
  _pageReady: false,
  _introStarted: false,
  _bgLoadAct: 0,
  _bgPathIndex: 0,

  onLoad(options) {
    const opts = options && typeof options === "object" ? options : {};
    this._from = opts.from ? String(opts.from) : "";
    this.applyViewport();
  },

  onReady() {
    this._pageReady = true;
    this.maybeStartIntro();
  },

  onShow() {
    this.applyViewport();
    this.maybeStartIntro();
    if (!this._resizeHandler && typeof wx.onWindowResize === "function") {
      this._resizeHandler = () => {
        this.applyViewport();
      };
      wx.onWindowResize(this._resizeHandler);
    }
  },

  maybeStartIntro() {
    if (this._introStarted || !this._pageReady) return;
    this._introStarted = true;
    this.startStep(0);
  },

  onHide() {
    this.clearTimers();
  },

  onUnload() {
    this.clearTimers();
    if (this._resizeHandler && typeof wx.offWindowResize === "function") {
      wx.offWindowResize(this._resizeHandler);
      this._resizeHandler = null;
    }
  },

  clearTimers() {
    ["_autoTimer", "_fadeTimer", "_actTimer"].forEach((key) => {
      if (this[key]) {
        clearTimeout(this[key]);
        this[key] = null;
      }
    });
    if (this._dissolveRun && typeof this._dissolveRun.cancel === "function") {
      this._dissolveRun.cancel();
    }
    this._dissolveRun = null;
    this._advancing = false;
  },

  applyViewport() {
    const vp = readViewport();
    const cur = this.data.viewport || {};
    if (
      cur.w === vp.w
      && cur.h === vp.h
      && cur.safeTop === vp.safeTop
      && cur.safeBottom === vp.safeBottom
    ) {
      return;
    }
    this.setData({ viewport: vp });
  },

  resetBgLoadState(act) {
    this._bgLoadAct = act;
    this._bgPathIndex = 0;
  },

  onBgLoad() {
    if (this._bgLoadAct !== this.data.bgAct) return;
    this.setData({
      bgImageVisible: true,
      bgUseFallback: false,
    });
  },

  onBgError() {
    if (this._bgLoadAct !== this.data.bgAct) return;

    const paths = bgAssets.pathsForAct(this.data.bgAct);
    const nextIndex = this._bgPathIndex + 1;
    if (nextIndex < paths.length) {
      this._bgPathIndex = nextIndex;
      this.setData({
        bgPath: paths[nextIndex],
        bgImageVisible: false,
        bgUseFallback: false,
      });
      return;
    }

    this.setData({
      bgUseFallback: true,
      bgImageVisible: false,
    });
  },

  applyBgForAct(act, actChanged) {
    this.resetBgLoadState(act);
    const paths = bgAssets.pathsForAct(act);
    this.setData({
      bgAct: act,
      bgPath: paths[0],
      bgImageVisible: actChanged ? false : this.data.bgImageVisible,
      bgUseFallback: actChanged ? false : this.data.bgUseFallback,
    });
  },

  lineMetricsForStep(text) {
    const vp = this.data.viewport || readViewport();
    const metrics = calcLineMetrics(vp.w);
    const canvasH = calcDissolveCanvasHeight(text, metrics.canvasW, metrics.fontSizePx);
    return { ...metrics, canvasH };
  },

  startDissolveCanvas(text) {
    const metrics = this.lineMetricsForStep(text);
    if (this._dissolveRun && typeof this._dissolveRun.cancel === "function") {
      this._dissolveRun.cancel();
    }
    wx.nextTick(() => {
      if (this.data.lineAnim !== "out") return;
      this._dissolveRun = startBrandIntroDissolve(this, {
        text,
        width: metrics.canvasW,
        height: metrics.canvasH,
        fontSize: metrics.fontSizePx,
        letterSpacing: metrics.letterSpacingPx,
        onReady: (startAnimation) => {
          if (this.data.lineAnim !== "out") return;
          this.setData({
            dissolveCanvasVisible: true,
            dissolveHideText: true,
          }, () => {
            if (typeof startAnimation === "function") startAnimation();
          });
        },
      });
    });
  },

  startStep(index) {
    const step = theme.BRAND_INTRO_STEPS[index];
    if (!step) return;

    this.clearTimers();
    this._advancing = false;

    const actChanged = index > 0
      && theme.BRAND_INTRO_STEPS[index - 1].act !== step.act;
    const { canvasH } = this.lineMetricsForStep(step.text);

    this.applyBgForAct(step.act, actChanged);

    this.setData({
      stepIndex: index,
      lineText: step.text,
      lineAnim: "in",
      lineStackH: canvasH,
      dissolveActive: false,
      dissolveHideText: false,
      dissolveCanvasVisible: false,
      showCta: false,
    });
    this.scheduleAutoAdvance();
  },

  scheduleAutoAdvance() {
    if (this._autoTimer) {
      clearTimeout(this._autoTimer);
      this._autoTimer = null;
    }
    if (this.data.showCta) return;

    const step = theme.BRAND_INTRO_STEPS[this.data.stepIndex];
    if (!step) return;

    const dwell = theme.dwellMsForLine(step.text);
    this._autoTimer = setTimeout(() => {
      this._autoTimer = null;
      if (this.data.stepIndex >= theme.BRAND_INTRO_STEPS.length - 1) {
        this.setData({ showCta: true });
        return;
      }
      this.advanceLine();
    }, dwell);
  },

  onTapAdvance() {
    if (this.data.showCta || this._advancing) return;
    if (this._autoTimer) {
      clearTimeout(this._autoTimer);
      this._autoTimer = null;
    }
    if (this.data.stepIndex >= theme.BRAND_INTRO_STEPS.length - 1) {
      this.setData({ showCta: true });
      return;
    }
    this.advanceLine();
  },

  advanceLine() {
    if (this.data.showCta || this._advancing) return;
    this._advancing = true;
    if (this._autoTimer) {
      clearTimeout(this._autoTimer);
      this._autoTimer = null;
    }

    const index = this.data.stepIndex;
    if (index >= theme.BRAND_INTRO_STEPS.length - 1) {
      this._advancing = false;
      this.setData({ showCta: true });
      return;
    }

    const nextIndex = index + 1;
    const actChanged = theme.BRAND_INTRO_STEPS[index].act !== theme.BRAND_INTRO_STEPS[nextIndex].act;
    const lineText = this.data.lineText;
    const { canvasW, canvasH } = this.lineMetricsForStep(lineText);

    this.setData({
      lineAnim: "out",
      dissolveActive: true,
      dissolveHideText: false,
      dissolveCanvasVisible: false,
      dissolveCanvasW: canvasW,
      dissolveCanvasH: canvasH,
      lineStackH: canvasH,
    });
    if (actChanged) {
      this.setData({ bgImageVisible: false });
    }
    this.startDissolveCanvas(lineText);

    if (this._fadeTimer) clearTimeout(this._fadeTimer);
    this._fadeTimer = setTimeout(() => {
      this._fadeTimer = null;
      const goNext = () => {
        this.startStep(nextIndex);
      };
      if (actChanged) {
        if (this._actTimer) clearTimeout(this._actTimer);
        this._actTimer = setTimeout(() => {
          this._actTimer = null;
          goNext();
        }, theme.ACT_GAP_MS);
        return;
      }
      goNext();
    }, theme.MAGIC_OUT_MS);
  },

  onSkip() {
    markBrandIntroSessionDismissed();
    this.leaveIntro();
  },

  onTapCta() {
    markBrandIntroSeen();
    const { goSleepHome } = require("../../utils/goTabHome");
    goSleepHome();
  },

  leaveIntro() {
    const pages = getCurrentPages();
    if (pages.length > 1) {
      wx.navigateBack();
      return;
    }
    const { goSleepHome } = require("../../utils/goTabHome");
    goSleepHome();
  },
});
