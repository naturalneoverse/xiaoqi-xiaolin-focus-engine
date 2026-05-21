/**
 * 四象限得分甜甜圈（canvas 2d）
 * scores: { q1, q2, q3, q4 } 各 0–120；弧长 = score/120 × 90°
 * 完成色块：顺时针（看见真实→…）依次「拉起」动画
 */

const COLORS = {
  q1: "#dcedf8",
  q2: "#ede5f6",
  q3: "#e3f4e8",
  q4: "#fcf0e4",
};

const TRACK = "rgba(239, 245, 252, 0.95)";

/** 象限交界处留白（单侧），约 4° */
const HALF_QUADRANT_GAP = (4 * Math.PI) / 180;

/** 画布 sectors 顺序：geom0=Q2, geom1=Q3, geom2=Q4, geom3=Q1；顺时针动画为 Q1→Q2→Q3→Q4 → 几何下标 [3,0,1,2] */
const CLOCKWISE_GEOM_INDEX = [3, 0, 1, 2];

const STAGGER_MS = 260;
const SECTOR_RAMP_MS = 520;

function easeOutCubic(t) {
  const u = 1 - Math.max(0, Math.min(1, t));
  return 1 - u * u * u;
}

function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}

function targetRatiosFromScores(scores) {
  const q1 = Number(scores.q1) || 0;
  const q2 = Number(scores.q2) || 0;
  const q3 = Number(scores.q3) || 0;
  const q4 = Number(scores.q4) || 0;
  return [clamp01(q2 / 120), clamp01(q3 / 120), clamp01(q4 / 120), clamp01(q1 / 120)];
}

function ratiosAtElapsed(elapsedMs, targets4) {
  const out = [0, 0, 0, 0];
  for (let ci = 0; ci < 4; ci++) {
    const geomIdx = CLOCKWISE_GEOM_INDEX[ci];
    const t0 = ci * STAGGER_MS;
    const local = clamp01((elapsedMs - t0) / SECTOR_RAMP_MS);
    const eased = easeOutCubic(local);
    out[geomIdx] = (targets4[geomIdx] || 0) * eased;
  }
  return out;
}

Component({
  properties: {
    scores: {
      type: Object,
      value: { q1: 0, q2: 0, q3: 0, q4: 0 },
    },
    mascotAnimPaused: {
      type: Boolean,
      value: false,
    },
  },

  data: {},

  lifetimes: {
    attached() {
      this._drawScheduled = false;
      this._drawGen = 0;
      this._ringRafId = null;
      this._onWindowResize = () => {
        this._cancelRingAnim();
        this.scheduleDraw();
      };
    },
    ready() {
      this.scheduleDraw();
      if (typeof wx.onWindowResize === "function") {
        wx.onWindowResize(this._onWindowResize);
      }
    },
    detached() {
      this._cancelRingAnim();
      if (typeof wx.offWindowResize === "function" && this._onWindowResize) {
        wx.offWindowResize(this._onWindowResize);
      }
    },
  },

  observers: {
    scores: function () {
      this._cancelRingAnim();
      this.scheduleDraw();
    },
  },

  methods: {
    onDonutMascotImgError(e) {
      console.warn("[reflection-donut-score] mascot image load error", e && e.detail);
    },

    _cancelRingAnim() {
      if (this._ringRafId != null) {
        try {
          clearTimeout(this._ringRafId);
        } catch (e) {
          /* ignore */
        }
        this._ringRafId = null;
      }
    },

    scheduleDraw() {
      if (this._drawScheduled) return;
      this._drawScheduled = true;
      wx.nextTick(() => {
        this._drawScheduled = false;
        this.drawDonut();
      });
    },

    drawDonut() {
      const scores = this.properties.scores || {};
      const targets4 = targetRatiosFromScores(scores);
      const gen = ++this._drawGen;

      const query = wx.createSelectorQuery().in(this);
      query
        .select("#donutCanvas")
        .fields({ node: true, size: true })
        .exec((res) => {
          if (gen !== this._drawGen) return;
          const first = res && res[0];
          if (!first || !first.node) return;
          const canvas = first.node;
          const dpr = wx.getSystemInfoSync().pixelRatio || 2;
          const cssW = first.width || 300;
          const cssH = first.height || 300;
          const side = Math.min(cssW, cssH);
          canvas.width = Math.floor(side * dpr);
          canvas.height = Math.floor(side * dpr);
          const ctx = canvas.getContext("2d");
          if (!ctx) return;
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.scale(dpr, dpr);

          const cx = cssW / 2;
          const cy = cssH / 2;
          const R = side * 0.4;
          const r0 = side * 0.214;
          const g = HALF_QUADRANT_GAP;
          const Q = Math.PI / 2;

          const q1 = Number(scores.q1) || 0;
          const q2 = Number(scores.q2) || 0;
          const q3 = Number(scores.q3) || 0;
          const q4 = Number(scores.q4) || 0;
          const sectors = [
            { start: 0 + g, end: Q - g, score: q2, color: COLORS.q2 },
            { start: Q + g, end: 2 * Q - g, score: q3, color: COLORS.q3 },
            { start: 2 * Q + g, end: 3 * Q - g, score: q4, color: COLORS.q4 },
            { start: 3 * Q + g, end: 4 * Q - g, score: q1, color: COLORS.q1 },
          ];

          const drawFrame = (ratios4) => {
            ctx.clearRect(0, 0, cssW, cssH);
            const drawSeg = (a0, a1, style) => {
              if (a1 <= a0) return;
              ctx.beginPath();
              ctx.arc(cx, cy, R, a0, a1, false);
              ctx.arc(cx, cy, r0, a1, a0, true);
              ctx.closePath();
              ctx.fillStyle = style;
              ctx.fill();
            };

            sectors.forEach((seg, i) => {
              const span = seg.end - seg.start;
              drawSeg(seg.start, seg.end, TRACK);
              const ratio = Math.max(0, Math.min(1, ratios4[i]));
              if (ratio > 0) {
                const a1 = seg.start + span * ratio;
                drawSeg(seg.start, a1, seg.color);
              }
            });

            const splitW = Math.max(1.25, side * 0.007);
            ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
            ctx.lineWidth = splitW;
            ctx.lineCap = "round";
            [0, Q, 2 * Q, 3 * Q].forEach((ang) => {
              ctx.beginPath();
              ctx.moveTo(cx + Math.cos(ang) * r0, cy + Math.sin(ang) * r0);
              ctx.lineTo(cx + Math.cos(ang) * R, cy + Math.sin(ang) * R);
              ctx.stroke();
            });
          };

          const sumT = targets4[0] + targets4[1] + targets4[2] + targets4[3];
          if (sumT <= 0) {
            drawFrame([0, 0, 0, 0]);
            return;
          }

          const totalMs = STAGGER_MS * 3 + SECTOR_RAMP_MS + 80;
          const start = Date.now();

          const tick = () => {
            if (gen !== this._drawGen) return;
            const elapsed = Date.now() - start;
            if (elapsed >= totalMs) {
              drawFrame(targets4);
              this._ringRafId = null;
              return;
            }
            drawFrame(ratiosAtElapsed(elapsed, targets4));
            this._ringRafId = setTimeout(tick, 16);
          };

          this._cancelRingAnim();
          drawFrame(ratiosAtElapsed(0, targets4));
          this._ringRafId = setTimeout(tick, 16);
        });
    },
  },
});
