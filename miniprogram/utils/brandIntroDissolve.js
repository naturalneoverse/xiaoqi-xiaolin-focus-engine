/**
 * 品牌引导：魔法书页式文字消融（Canvas 微光颗粒）
 */

const DISSOLVE_MS = 2400;
const LINE_HEIGHT = 1.55;
const MAX_PARTICLES = 520;

/** 与 index.wxss .intro-line font-size:46rpx 对齐 */
function calcLineMetrics(viewportW) {
  const w = Number(viewportW) > 0 ? Number(viewportW) : 375;
  const fontSizePx = (w * 46) / 750;
  const letterSpacingPx = (w * 3) / 750;
  const paddingPx = (w * 56) / 750;
  const canvasW = Math.max(200, w - paddingPx * 2);
  return { fontSizePx, letterSpacingPx, canvasW };
}

function smoothstep(t) {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

function sampleParticles(imageData, pw, ph, dpr) {
  const data = imageData.data;
  const particles = [];
  const step = 3;
  const cx = pw / 2;
  const cy = ph / 2;
  const maxDist = Math.hypot(cx, cy) || 1;

  for (let y = 0; y < ph; y += step) {
    for (let x = 0; x < pw; x += step) {
      const i = (y * pw + x) * 4;
      if (data[i + 3] < 64) continue;
      const lx = x / dpr;
      const ly = y / dpr;
      const dist = Math.hypot(x - cx, y - cy);
      const edgeFactor = dist / maxDist;
      particles.push({
        x: lx,
        y: ly,
        vx: (Math.random() - 0.5) * 0.14,
        vy: -0.06 - Math.random() * 0.22,
        size: 0.45 + Math.random() * 1.2,
        delay: (1 - edgeFactor) * 0.58,
        glow: 0.32 + Math.random() * 0.48,
      });
    }
  }

  if (particles.length > MAX_PARTICLES) {
    for (let i = particles.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = particles[i];
      particles[i] = particles[j];
      particles[j] = tmp;
    }
    particles.length = MAX_PARTICLES;
  }
  return particles;
}

function fillTextLine(ctx, line, cx, y, letterSpacing) {
  const text = String(line || "");
  if (!letterSpacing || letterSpacing <= 0) {
    ctx.fillText(text, cx, y);
    return;
  }
  const chars = Array.from(text);
  if (!chars.length) return;
  const widths = chars.map((ch) => ctx.measureText(ch).width);
  const totalW = widths.reduce((sum, width) => sum + width, 0)
    + letterSpacing * Math.max(0, chars.length - 1);
  let x = cx - totalW / 2;
  const prevAlign = ctx.textAlign;
  ctx.textAlign = "left";
  chars.forEach((ch, idx) => {
    ctx.fillText(ch, x, y);
    x += widths[idx] + letterSpacing;
  });
  ctx.textAlign = prevAlign;
}

function drawTextLines(ctx, lines, cw, ch, fontSizePx, letterSpacing) {
  const lineH = fontSizePx * LINE_HEIGHT;
  const totalH = lines.length * lineH;
  const startY = (ch - totalH) / 2 + lineH / 2;
  ctx.save();
  ctx.shadowColor = "rgba(183, 214, 234, 0.45)";
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 4;
  lines.forEach((line, idx) => {
    fillTextLine(ctx, line, cw / 2, startY + idx * lineH, letterSpacing);
  });
  ctx.restore();
  return { startY, lineH, lines, totalH, fontSizePx, letterSpacing };
}

function easeOutSoft(t) {
  return 1 - Math.pow(1 - t, 1.65);
}

function drawParticles(ctx, particles, progress) {
  particles.forEach((p) => {
    if (progress < p.delay) return;
    const span = Math.max(0.1, 1 - p.delay);
    const t = smoothstep((progress - p.delay) / span);
    const alpha = (1 - t) * p.glow;
    if (alpha < 0.015) return;
    const drift = easeOutSoft(t);
    const px = p.x + p.vx * drift * 20;
    const py = p.y + p.vy * drift * 26;
    const tailAlpha = alpha * 0.35;
    ctx.save();
    ctx.strokeStyle = `rgba(220, 238, 255, ${tailAlpha})`;
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px - p.vx * 6, py - p.vy * 8);
    ctx.stroke();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "#f4fbff";
    ctx.shadowColor = "rgba(201, 229, 251, 0.75)";
    ctx.shadowBlur = 2 + (1 - t) * 4;
    ctx.beginPath();
    ctx.arc(px, py, p.size * (1 - t * 0.45), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

function drawTextRemnant(ctx, layout, cw, progress) {
  const { lines, startY, lineH, letterSpacing } = layout;
  const fadeStart = 0.12;
  const fadeT = progress <= fadeStart
    ? 0
    : (progress - fadeStart) / (1 - fadeStart);
  const baseFade = Math.max(0, 1 - easeOutSoft(Math.min(1, fadeT / 0.96)));
  if (baseFade < 0.02) return;
  ctx.save();
  ctx.globalAlpha = baseFade * 0.92;
  ctx.shadowColor = "rgba(183, 214, 234, 0.45)";
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 4;
  lines.forEach((line, idx) => {
    fillTextLine(ctx, line, cw / 2, startY + idx * lineH, letterSpacing);
  });
  ctx.restore();
}

/**
 * @param {object} page 页面实例
 * @param {{ text: string, width: number, height: number, fontSize?: number, letterSpacing?: number, canvasId?: string, onReady?: function }} options
 * @returns {{ cancel: function }}
 */
function startBrandIntroDissolve(page, options) {
  const opts = options && typeof options === "object" ? options : {};
  const text = String(opts.text || "");
  const cw = Number(opts.width) > 0 ? Number(opts.width) : 300;
  const ch = Number(opts.height) > 0 ? Number(opts.height) : 100;
  const fontSizePx = Number(opts.fontSize) > 0 ? Number(opts.fontSize) : 23;
  const letterSpacingPx = Number(opts.letterSpacing) >= 0 ? Number(opts.letterSpacing) : 0;
  const onReady = typeof opts.onReady === "function" ? opts.onReady : null;
  const canvasId = opts.canvasId || "dissolveCanvas";
  let cancelled = false;
  let rafId = null;
  let canvasNode = null;
  let pendingStart = null;

  const cancel = () => {
    cancelled = true;
    if (canvasNode && rafId != null && typeof canvasNode.cancelAnimationFrame === "function") {
      canvasNode.cancelAnimationFrame(rafId);
    }
    rafId = null;
  };

  const query = wx.createSelectorQuery().in(page);
  query
    .select(`#${canvasId}`)
    .fields({ node: true, size: true })
    .exec((res) => {
      if (cancelled || !res || !res[0] || !res[0].node) return;
      canvasNode = res[0].node;
      const ctx = canvasNode.getContext("2d");
      let dpr = 2;
      try {
        dpr = wx.getWindowInfo().pixelRatio || 2;
      } catch (e) {
        dpr = 2;
      }

      canvasNode.width = Math.round(cw * dpr);
      canvasNode.height = Math.round(ch * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.font = `500 ${fontSizePx}px -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#eff7fd";

      const lines = text.split("\n").filter((s) => s.length > 0);
      if (!lines.length) lines.push("");

      ctx.clearRect(0, 0, cw, ch);
      drawTextLines(ctx, lines, cw, ch, fontSizePx, letterSpacingPx);
      const imageData = ctx.getImageData(0, 0, canvasNode.width, canvasNode.height);
      const particles = sampleParticles(imageData, canvasNode.width, canvasNode.height, dpr);
      const layout = drawTextLines(ctx, lines, cw, ch, fontSizePx, letterSpacingPx);

      const renderFrame = (progress) => {
        ctx.clearRect(0, 0, cw, ch);
        drawTextRemnant(ctx, layout, cw, progress);
        drawParticles(ctx, particles, progress);
      };

      renderFrame(0);

      const startAnimation = () => {
        if (cancelled || rafId != null) return;
        const startTime = Date.now();
        const tick = () => {
          if (cancelled) return;
          const elapsed = Date.now() - startTime;
          const linear = Math.min(1, elapsed / DISSOLVE_MS);
          const progress = easeOutSoft(linear);
          renderFrame(progress);
          if (linear < 1) {
            rafId = canvasNode.requestAnimationFrame(tick);
          } else {
            ctx.clearRect(0, 0, cw, ch);
            rafId = null;
          }
        };
        rafId = canvasNode.requestAnimationFrame(tick);
      };

      pendingStart = startAnimation;
      if (onReady) {
        onReady(startAnimation);
      } else {
        startAnimation();
      }
    });

  return {
    cancel,
    startAnimation: () => {
      if (typeof pendingStart === "function") pendingStart();
    },
  };
}

function calcDissolveCanvasHeight(text, width, fontSizePx) {
  const lines = String(text || "").split("\n");
  const lineCount = Math.max(1, lines.length);
  const fs = Number(fontSizePx) > 0 ? Number(fontSizePx) : 23;
  const lineH = fs * LINE_HEIGHT;
  return Math.ceil(lineCount * lineH + 28);
}

module.exports = {
  DISSOLVE_MS,
  calcLineMetrics,
  startBrandIntroDissolve,
  calcDissolveCanvasHeight,
};
