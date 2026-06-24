const theme = require("../../config/brandIntroTheme");
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

function speakerView(speakerKey) {
  const meta = theme.UI.speaker[speakerKey] || theme.UI.speaker.lin;
  if (speakerKey === "both") {
    return {
      ...meta,
      dual: true,
      align: meta.align || "center",
    };
  }
  return {
    ...meta,
    dual: false,
    align: meta.align || "left",
  };
}

Page({
  data: {
    viewport: {
      w: 375,
      h: 812,
      safeTop: 0,
      safeBottom: 0,
      pageStyle: "",
      textZoneStyle: "",
      mascotZoneStyle: "",
      mascotImgStyle: "",
      mascotDualImgStyle: "",
      introNavStyle: "bottom:128px;",
      introNavCtaStyle: "bottom:160px;",
      introSkipStyle: "bottom:20px;",
      introCtaFooterStyle: "bottom:56px;",
    },
    bgPath: theme.BACKGROUND_PATH,
    bgFallback: false,
    skyFallbackCss: theme.SKY_GRADIENT_CSS,
    stepIndex: 0,
    lineText: "",
    lineAnim: "",
    lineStackH: 80,
    dissolveActive: false,
    dissolveHideText: false,
    dissolveCanvasVisible: false,
    dissolveCanvasW: 300,
    dissolveCanvasH: 80,
    mascotVisible: false,
    speaker: speakerView("lin"),
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
  _bgCandidateIndex: -1,

  onLoad(options) {
    const opts = options && typeof options === "object" ? options : {};
    this._from = opts.from ? String(opts.from) : "";
    this.applyViewport();
    this.loadBackgroundImage(0);
  },

  bgCandidates() {
    return [theme.BACKGROUND_PATH, theme.BACKGROUND_PATH_ABS].filter(Boolean);
  },

  loadBackgroundImage(index) {
    const candidates = this.bgCandidates();
    if (index >= candidates.length) {
      this.setData({ bgFallback: true });
      return;
    }
    this._bgCandidateIndex = index;
    const src = candidates[index];
    wx.getImageInfo({
      src,
      success: (res) => {
        const path = (res && res.path) ? res.path : src;
        this.setData({ bgPath: path, bgFallback: false });
      },
      fail: () => this.loadBackgroundImage(index + 1),
    });
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

  onBgError() {
    const next = (this._bgCandidateIndex >= 0 ? this._bgCandidateIndex : 0) + 1;
    this.loadBackgroundImage(next);
  },

  onMascotError() {
    const fallback = "/images/transparent background/avatar.png";
    const speaker = { ...(this.data.speaker || {}) };
    if (speaker.dual) {
      speaker.avatar = fallback;
      speaker.avatarAlt = fallback;
    } else {
      speaker.avatar = fallback;
    }
    this.setData({ speaker });
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
    const { canvasW, canvasH } = this.lineMetricsForStep(step.text);

    this.setData({
      stepIndex: index,
      lineText: step.text,
      speaker: speakerView(step.speaker),
      lineAnim: "in",
      lineStackH: canvasH,
      dissolveActive: false,
      dissolveHideText: false,
      dissolveCanvasVisible: false,
      mascotVisible: !actChanged,
      showCta: false,
    });
    if (actChanged) {
      wx.nextTick(() => {
        this.setData({ mascotVisible: true });
      });
    }
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
      this.setData({ mascotVisible: false });
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
