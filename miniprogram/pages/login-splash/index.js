const {
  LOGIN_SPLASH_FILE_ID,
  LOGIN_SPLASH_DURATION_MS,
  LOGIN_SPLASH_LOAD_TIMEOUT_MS,
} = require("../../config/loginSplashConfig");
const { goSleepHome } = require("../../utils/goTabHome");
const { isCloudReady } = require("../../utils/cloudCall");

Page({
  data: {
    videoSrc: "",
    muted: false,
    loadingHint: "正在加载…",
    showEnterBtn: false,
  },

  _next: "tags",
  _didNav: false,
  _waitTimer: null,
  _loadTimeoutTimer: null,
  _videoCtx: null,
  _playStartedAt: 0,

  onLoad(options) {
    const next = String((options && options.next) || "tags").trim();
    this._next = next === "home" ? "home" : "tags";
    this._startLoadTimeout();
    this._resolveVideoSrc();
  },

  onReady() {
    this._videoCtx = wx.createVideoContext("splashVideo", this);
  },

  onUnload() {
    this._clearWaitTimer();
    this._clearLoadTimeout();
  },

  _clearWaitTimer() {
    if (this._waitTimer) {
      clearTimeout(this._waitTimer);
      this._waitTimer = null;
    }
  },

  _clearLoadTimeout() {
    if (this._loadTimeoutTimer) {
      clearTimeout(this._loadTimeoutTimer);
      this._loadTimeoutTimer = null;
    }
  },

  /** 起播前：最多等待 LOAD_TIMEOUT，未起播则静默跳过 */
  _startLoadTimeout() {
    this._clearLoadTimeout();
    this._loadTimeoutTimer = setTimeout(() => {
      this._loadTimeoutTimer = null;
      if (this._playStartedAt || this._didNav) return;
      console.warn("[login-splash] load timeout, skip splash");
      this._navigateNext();
    }, LOGIN_SPLASH_LOAD_TIMEOUT_MS);
  },

  /** 加载失败且尚未起播：立刻静默跳过（不等满 6 秒） */
  _skipDueToLoadFailure(reason) {
    if (this._playStartedAt || this._didNav) return;
    if (reason) {
      console.warn("[login-splash] load failed, skip splash", reason);
    }
    this._navigateNext();
  },

  /** 方案 A：起播后播满时长再出现进入按钮，需用户点击才跳转 */
  _scheduleShowEnterButton() {
    this._clearWaitTimer();
    const started = this._playStartedAt || Date.now();
    const remain = Math.max(0, LOGIN_SPLASH_DURATION_MS - (Date.now() - started));
    this._waitTimer = setTimeout(() => {
      this._revealEnterButton();
    }, remain);
  },

  _revealEnterButton() {
    if (this.data.showEnterBtn) return;
    this._pauseVideoHoldFrame();
    this.setData({ showEnterBtn: true });
  },

  _pauseVideoHoldFrame() {
    if (!this._videoCtx) return;
    try {
      this._videoCtx.pause();
    } catch (e) {
      /* ignore */
    }
  },

  _resolveVideoSrc() {
    const fileID = String(LOGIN_SPLASH_FILE_ID || "").trim();
    if (!fileID || !isCloudReady()) {
      this._skipDueToLoadFailure("cloud not ready");
      return;
    }

    wx.cloud
      .getTempFileURL({ fileList: [fileID] })
      .then((res) => {
        if (this._didNav || this._playStartedAt) return;
        const row = res && res.fileList && res.fileList[0];
        const url = row && row.tempFileURL ? String(row.tempFileURL) : "";
        if (!url || row.status !== 0) {
          return this._downloadFallback(fileID);
        }
        this.setData({ videoSrc: url });
      })
      .catch((err) => {
        if (this._didNav || this._playStartedAt) return;
        this._downloadFallback(fileID);
      });
  },

  _downloadFallback(fileID) {
    if (this._didNav || this._playStartedAt) return;
    if (!wx.cloud || typeof wx.cloud.downloadFile !== "function") {
      this._skipDueToLoadFailure("downloadFile unavailable");
      return;
    }
    wx.cloud
      .downloadFile({ fileID })
      .then((res) => {
        if (this._didNav || this._playStartedAt) return;
        const path = res && res.tempFilePath ? String(res.tempFilePath) : "";
        if (path) {
          this.setData({ videoSrc: path });
        } else {
          this._skipDueToLoadFailure("empty tempFilePath");
        }
      })
      .catch((err) => {
        if (this._didNav || this._playStartedAt) return;
        this._skipDueToLoadFailure(err);
      });
  },

  onVideoPlay() {
    if (!this._playStartedAt) {
      this._playStartedAt = Date.now();
      this._clearLoadTimeout();
      this._scheduleShowEnterButton();
    }
    if (this._videoCtx) {
      try {
        this._videoCtx.play();
      } catch (e) {
        /* ignore */
      }
    }
  },

  onVideoEnded() {
    this._pauseVideoHoldFrame();
    const started = this._playStartedAt;
    if (!started) {
      return;
    }
    const elapsed = Date.now() - started;
    if (elapsed >= LOGIN_SPLASH_DURATION_MS - 500) {
      this._revealEnterButton();
    } else {
      this._clearWaitTimer();
      const remain = Math.max(0, LOGIN_SPLASH_DURATION_MS - elapsed);
      this._waitTimer = setTimeout(() => {
        this._revealEnterButton();
      }, remain);
    }
  },

  onVideoError(e) {
    console.warn("[login-splash] video error", e && e.detail);
    if (!this._playStartedAt) {
      this._skipDueToLoadFailure("video error before play");
      return;
    }
    this._revealEnterButton();
  },

  onTapSoundToggle() {
    const muted = !this.data.muted;
    this.setData({ muted });
    if (this._videoCtx) {
      try {
        this._videoCtx.play();
      } catch (e) {
        /* ignore */
      }
    }
  },

  onTapEnter() {
    this._navigateNext();
  },

  _navigateNext() {
    if (this._didNav) return;
    this._didNav = true;
    this._clearWaitTimer();
    this._clearLoadTimeout();
    if (this._videoCtx) {
      try {
        this._videoCtx.stop();
      } catch (e) {
        /* ignore */
      }
    }
    if (this._next === "home") {
      goSleepHome();
      return;
    }
    wx.redirectTo({ url: "/pages/onboarding-tags/index" });
  },
});
