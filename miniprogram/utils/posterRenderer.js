/**
 * 真我时刻海报：逻辑画布固定 1080×1920（9:16）；盲盒渐变 + accent；盲盒一金句（≥21 锁定）；盲盒三衬线/非衬线。
 * 导出：整幅 1080×1920 PNG；物理尺寸 = 逻辑 × devicePixelRatio。
 *
 * Logo 稳定性（真机验证，见 .cursor/rules/poster-logo-stable.mdc）：
 * 须由页面传入 logoProcessCanvas（#posterLogoWork）；勿改为仅离屏或仅 destination-in。
 */

const POSTER_W = 1080;
const POSTER_H = 1920;
const MARGIN_X = 60;
const TEXT_W = POSTER_W - MARGIN_X * 2;

/** 纵向方案 A：链式间距；金句→码区间距由底部留白目标动态计算 */
const SP_BRAND_TO_STATUS = 64;
const SP_STATUS_TO_DATA = 56;
const SP_BRAND_TO_DATA_COLLAPSED = 56;
const SP_DATA_TO_QUOTE = 88;
/** 金句→引导小字 最小间距；实际取值不低于此，并按底部留白目标加大 */
const SP_QUOTE_TO_QR_MIN = 48;
/** 顶部首行（Logo 带上缘）距画布顶：60~80px 取中 */
const TOP_PAD = 76;
/** 画布底至内容收束后的留白：100~120px 取中 */
const BOTTOM_SAFE = 110;

const COLOR_BRAND = "#2C3E50";
const COLOR_CYCLE = "#8A9CB0";
const COLOR_LINE = "#E0E0E0";
const COLOR_STATUS = "#4A4A4A";
const COLOR_LABEL = "#7F8C8D";
const COLOR_SECONDARY = "#95A5A6";
const COLOR_QUOTE_BODY = "#2C3E50";
const COLOR_QUOTE_MARK = "#D5D8DC";
const COLOR_GUIDE = "#ADB5BD";
const COLOR_CTA = "#2C3E50";

const QUOTES = [
  "你编织的，不是时间，是自己。",
  "人不是其所是，是其所不是。",
  "每一次开始，都是一次诞生。",
  "你看见时间的那一刻，时间才属于你。",
  "成为自己，是唯一值得做的事。",
  "边界不是终点，是开始的起点。",
  "劳动为了生存，工作为了世界，行动为了成为。",
  "向死而生，每一天都是选择。",
  "真正的自由，是说\"不\"的能力。",
  "你此刻在哪里，你就活在哪里。",
  "不二，自他一体。",
  "合一，便是完整。",
  "你的时间质地，就是你的生命质地。",
  "记下你要做的，时间就有了形状。",
  "宽恕过去，才能开始未来。",
];

const PALETTES = [
  { bg0: "#EFF7FD", bg1: "#D6EBF7", accent: "#12598F" },
  { bg0: "#F5F0FA", bg1: "#E8DFF5", accent: "#6B4C8A" },
  { bg0: "#F0F7F0", bg1: "#DCE8DC", accent: "#3D6B4F" },
  { bg0: "#FDF7F0", bg1: "#F5E8D8", accent: "#C0713B" },
  { bg0: "#EDF5FA", bg1: "#C5D9E8", accent: "#1B4F72" },
  { bg0: "#F5F3F0", bg1: "#E8E3DC", accent: "#5C4F45" },
  { bg0: "#F2F8F2", bg1: "#D8EDD8", accent: "#2E6B3E" },
  { bg0: "#FDF5F5", bg1: "#F5E0E0", accent: "#A0525A" },
];

const MILESTONE_21 = "21天，你活成了自己选择的样子。";
const ZERO_COPY = "这一周，为生存和责任奔波，辛苦了。";
const GUIDE_ABOVE_QR = "微信扫一扫 · 生成你的真我时刻";
const CTA_TEXT = "看看你有多少真我时刻 →";

const QR_OUTER = 260;
const QR_INNER = 220;
const QR_RADIUS = 20;
const QR_INNER_RADIUS = 12;

/**
 * 金句结束 y 至画布底：引导(44) + 码区 + CTA 约 50；须放在 QR_OUTER 定义之后
 */
const TAIL_AFTER_QUOTE = 44 + QR_OUTER + 24 + 50;

const LOGO_BOX = 80;
const BRAND_GAP = 16;
const DECO_LINE_W = 120;
const DECO_LINE_H = 2;

function rollBlindBox() {
  return {
    paletteIndex: Math.floor(Math.random() * PALETTES.length),
    quoteIndex: Math.floor(Math.random() * QUOTES.length),
    fontStyle: Math.random() < 0.5 ? 0 : 1,
  };
}

function getQuoteInnerText(streakDays, quoteIndex) {
  if (streakDays >= 21) return MILESTONE_21;
  const i = Math.max(0, Math.min(QUOTES.length - 1, quoteIndex | 0));
  return QUOTES[i];
}

function hexToRgba(hex, alpha) {
  const h = String(hex || "").replace("#", "");
  if (h.length !== 6) return `rgba(44,62,80,${alpha})`;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function hexToLineColorObj(hex) {
  const h = String(hex || "").replace("#", "");
  if (h.length !== 6) return { r: "24", g: "64", b: "97" };
  return {
    r: String(parseInt(h.slice(0, 2), 16)),
    g: String(parseInt(h.slice(2, 4), 16)),
    b: String(parseInt(h.slice(4, 6), 16)),
  };
}

function wrapLines(ctx, text, maxWidth) {
  const chars = String(text).split("");
  const lines = [];
  let line = "";
  for (let i = 0; i < chars.length; i += 1) {
    const test = line + chars[i];
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = chars[i];
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

function roundRectPath(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

function drawTextCenterInWidth(ctx, text, left, width, yBaseline, color) {
  ctx.fillStyle = color;
  const w = ctx.measureText(text).width;
  ctx.fillText(text, left + (width - w) / 2, yBaseline);
}

function quoteBodyFontSize(inner) {
  const n = String(inner).length;
  if (n <= 18) return 38;
  if (n <= 26) return 34;
  return 30;
}

function bodyFontForStyle(fontStyle, sizePx) {
  if (fontStyle === 0) return `500 ${sizePx}px STSong, Songti SC, Georgia, serif`;
  return `500 ${sizePx}px PingFang SC, Helvetica Neue, sans-serif`;
}

/** 方案 C1：弯引号用宋体/Georgia 栈，与正文块整体水平居中 */
function drawQuoteSectionFixed(ctx, cx, yStart, innerText, fontStyle) {
  const markFont =
    '400 68px "Songti SC", STSong, STKaiti, "Kaiti SC", Georgia, "Times New Roman", serif';
  const sizePx = quoteBodyFontSize(innerText);
  const lh = sizePx * 1.5;
  const bodyFont = bodyFontForStyle(fontStyle, sizePx);
  const innerGap = 10;
  const bodyMaxW = TEXT_W - 140;

  ctx.font = markFont;
  const qwL = ctx.measureText("「").width;
  const qwR = ctx.measureText("」").width;

  ctx.font = bodyFont;
  const bodyLines = wrapLines(ctx, innerText, bodyMaxW);
  let maxW = 0;
  bodyLines.forEach((ln) => {
    const w = ctx.measureText(ln).width;
    if (w > maxW) maxW = w;
  });

  const bodyBlockW = maxW;
  const totalW = qwL + innerGap + bodyBlockW + innerGap + qwR;
  const blockStart = cx - totalW / 2;
  const topPad = Math.max(0, (bodyLines.length * lh - 68) / 2);
  const quoteTop = yStart + topPad;
  const markBaseline = quoteTop + 56;

  ctx.fillStyle = COLOR_QUOTE_MARK;
  ctx.font = markFont;
  ctx.textAlign = "left";
  ctx.fillText("「", blockStart, markBaseline);

  ctx.fillStyle = COLOR_QUOTE_BODY;
  ctx.font = bodyFont;
  const bodyLeft = blockStart + qwL + innerGap;
  bodyLines.forEach((ln, i) => {
    const w = ctx.measureText(ln).width;
    ctx.fillText(ln, bodyLeft + (bodyBlockW - w) / 2, markBaseline + i * lh);
  });

  ctx.fillStyle = COLOR_QUOTE_MARK;
  ctx.font = markFont;
  const lastBaseline = markBaseline + (bodyLines.length - 1) * lh;
  ctx.fillText("」", blockStart + qwL + innerGap + bodyBlockW + innerGap, lastBaseline);

  return quoteTop + 56 + bodyLines.length * lh + 28;
}

function loadImage(createImage, src) {
  return new Promise((resolve) => {
    if (!src || !createImage) {
      resolve(null);
      return;
    }
    const img = createImage();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function parseAccentRgb(hex) {
  const h = String(hex || "").replace("#", "");
  if (h.length !== 6) return { r: 24, g: 64, b: 97 };
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function parseHexRgb(hex) {
  return parseAccentRgb(hex);
}

/** 与海报纵向渐变一致：y ∈ [0, POSTER_H]，与 createLinearGradient(0,0,0,POSTER_H) 同色 */
function samplePosterBgAtY(y, palette) {
  const t = Math.max(0, Math.min(1, y / POSTER_H));
  const c0 = parseHexRgb(palette.bg0);
  const c1 = parseHexRgb(palette.bg1);
  return {
    r: Math.round(c0.r + (c1.r - c0.r) * t),
    g: Math.round(c0.g + (c1.g - c0.g) * t),
    b: Math.round(c0.b + (c1.b - c0.b) * t),
  };
}

/** 高阈值纯白 */
function isStrongWhite(r, g, b, t) {
  return r >= t && g >= t && b >= t;
}

/** 浅灰 / 米白等「平」浅底（仅用 RGB，避免把低 Alpha 描边整块当底） */
function isLightFlatBackdrop(r, g, b) {
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const avg = (r + g + b) / 3;
  return mx >= 198 && mx - mn <= 42 && avg >= 182;
}

/** 黑 / 深灰平铺底 */
function isDarkFlatBackdrop(r, g, b) {
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const sum = r + g + b;
  return mx <= 68 && mx - mn <= 38 && sum < 175;
}

/** BFS 种子与孤立底：白、浅灰平、深灰平、近透明 */
function isLogoBackdropLike(r, g, b, a, whiteT) {
  const t = whiteT == null ? 228 : whiteT;
  if (a < 10) return true;
  if (isStrongWhite(r, g, b, t)) return true;
  if (isLightFlatBackdrop(r, g, b)) return true;
  if (isDarkFlatBackdrop(r, g, b)) return true;
  return false;
}

/**
 * 从四边 BFS：与边缘连通的底图像素 → 用海报渐变不透明填实（避免 PNG 真透明在相册/组件里黑白不一致）。
 * 其余像素 → accent，保留 Alpha。
 */
function tintLogoImageData(id, accentHex, palette, slotDy, slotDh, whiteThreshold) {
  const t = whiteThreshold == null ? 228 : whiteThreshold;
  const { r: ar, g: ag, b: ab } = parseAccentRgb(accentHex);
  const W = id.width;
  const H = id.height;
  const d = id.data;
  const n = W * H;
  const flood = new Uint8Array(n);

  function bgLike(r, g, b, a) {
    return isLogoBackdropLike(r, g, b, a, t);
  }

  const qx = [];
  const qy = [];
  function push(x, y) {
    const p = y * W + x;
    if (flood[p]) return;
    const i = p * 4;
    const r = d[i];
    const g = d[i + 1];
    const b = d[i + 2];
    const a = d[i + 3];
    if (!bgLike(r, g, b, a)) return;
    flood[p] = 1;
    qx.push(x);
    qy.push(y);
  }

  for (let x = 0; x < W; x += 1) {
    push(x, 0);
    push(x, H - 1);
  }
  for (let y = 0; y < H; y += 1) {
    push(0, y);
    push(W - 1, y);
  }

  let qi = 0;
  while (qi < qx.length) {
    const x = qx[qi];
    const y = qy[qi];
    qi += 1;
    const nb = [
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1],
    ];
    for (let k = 0; k < nb.length; k += 1) {
      const nx = nb[k][0];
      const ny = nb[k][1];
      if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
      push(nx, ny);
    }
  }

  for (let p = 0; p < n; p += 1) {
    const i = p * 4;
    const r = d[i];
    const g = d[i + 1];
    const b = d[i + 2];
    const a = d[i + 3];
    const py = (p / W) | 0;
    const posterY = slotDy + ((py + 0.5) / H) * slotDh;
    const bg = samplePosterBgAtY(posterY, palette);

    if (flood[p]) {
      d[i] = bg.r;
      d[i + 1] = bg.g;
      d[i + 2] = bg.b;
      d[i + 3] = 255;
      continue;
    }
    if (a < 6) {
      d[i] = bg.r;
      d[i + 1] = bg.g;
      d[i + 2] = bg.b;
      d[i + 3] = 255;
      continue;
    }
    if (isLogoBackdropLike(r, g, b, a, t)) {
      d[i] = bg.r;
      d[i + 1] = bg.g;
      d[i + 2] = bg.b;
      d[i + 3] = 255;
      continue;
    }
    d[i] = ar;
    d[i + 1] = ag;
    d[i + 2] = ab;
    d[i + 3] = a;
  }
}

/**
 * Logo：去白边 + accent 着色。
 * 原因：很多 logo.png 外沿带不透明白（或灰）矩形，仅用 destination-in 会整块变成 accent 方框；
 * 透明区在小程序 Canvas 上若未先铺渐变，会透出默认白底。
 * 做法：clip 内先铺纵向渐变；优先用页面内 type=2d 小画布做 getImageData（真机离屏 API 常失败），否则再试 wx.createOffScreenCanvas。
 */
function drawLogoViaPixelCanvas(cnode, mainCtx, img, dx, dy, dw, dh, W, H, accent, palette, slotDy, slotDh) {
  if (!cnode || typeof cnode.getContext !== "function") return false;
  try {
    cnode.width = W;
    cnode.height = H;
  } catch (e) {
    return false;
  }
  const wctx = cnode.getContext("2d");
  if (!wctx) return false;
  try {
    wctx.clearRect(0, 0, W, H);
    wctx.drawImage(img, 0, 0, dw, dh);
    const id = wctx.getImageData(0, 0, W, H);
    tintLogoImageData(id, accent, palette, slotDy, slotDh, 228);
    wctx.putImageData(id, 0, 0);
    mainCtx.drawImage(cnode, 0, 0, W, H, dx, dy, dw, dh);
    return true;
  } catch (e) {
    console.warn("poster logo pixel canvas", e);
    return false;
  }
}

function drawLogoInSlot(ctx, img, x, y, w, h, _radius, accent, bgGradient, palette, logoProcessCanvas) {
  if (!img || !img.width) return;
  const sw = img.width;
  const sh = img.height;
  const scale = Math.max(w / sw, h / sh);
  const dw = sw * scale;
  const dh = sh * scale;
  const dx = x + (w - dw) / 2;
  const dy = y + (h - dh) / 2;
  const W = Math.max(1, Math.ceil(dw));
  const H = Math.max(1, Math.ceil(dh));

  ctx.save();
  ctx.beginPath();
  ctx.rect(dx, dy, dw, dh);
  ctx.clip();
  ctx.fillStyle = bgGradient;
  ctx.fillRect(dx, dy, dw, dh);

  let drawn = false;
  if (logoProcessCanvas && drawLogoViaPixelCanvas(logoProcessCanvas, ctx, img, dx, dy, dw, dh, W, H, accent, palette, dy, dh)) {
    drawn = true;
  }

  if (!drawn && typeof wx.createOffScreenCanvas === "function") {
    try {
      const oc = wx.createOffScreenCanvas({ type: "2d", width: W, height: H });
      const octx = oc.getContext("2d");
      if (octx) {
        octx.clearRect(0, 0, W, H);
        octx.drawImage(img, 0, 0, dw, dh);
        const id = octx.getImageData(0, 0, W, H);
        tintLogoImageData(id, accent, palette, dy, dh, 228);
        octx.putImageData(id, 0, 0);
        ctx.drawImage(oc, 0, 0, W, H, dx, dy, dw, dh);
        drawn = true;
      }
    } catch (e) {
      console.warn("poster logo offscreen", e);
    }
  }

  if (!drawn) {
    ctx.fillStyle = accent;
    ctx.fillRect(dx, dy, dw, dh);
    ctx.globalCompositeOperation = "destination-in";
    ctx.drawImage(img, dx, dy, dw, dh);
    ctx.globalCompositeOperation = "source-over";
  }
  ctx.restore();
}

/** B1：Logo + 品牌名 + 装饰线整体水平居中（仅 Logo 用 accent，字与装饰线不变） */
function drawBrandStripCentered(ctx, cx, yTop, logoImg, accent, bgGradient, palette, logoProcessCanvas) {
  const brandText = "小麒小麟专注引擎";
  ctx.font = "600 40px PingFang SC, Helvetica Neue, sans-serif";
  const tw = ctx.measureText(brandText).width;
  const rowW = LOGO_BOX + BRAND_GAP + tw + BRAND_GAP + DECO_LINE_W;
  let rowStart = cx - rowW / 2;
  if (rowStart < MARGIN_X) rowStart = MARGIN_X;
  if (rowStart + rowW > POSTER_W - MARGIN_X) rowStart = POSTER_W - MARGIN_X - rowW;

  let x = rowStart;
  if (logoImg) {
    drawLogoInSlot(ctx, logoImg, x, yTop, LOGO_BOX, LOGO_BOX, 16, accent, bgGradient, palette, logoProcessCanvas);
  } else {
    ctx.strokeStyle = accent;
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 1;
    roundRectPath(ctx, x, yTop, LOGO_BOX, LOGO_BOX, 16);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  x += LOGO_BOX + BRAND_GAP;

  ctx.fillStyle = COLOR_BRAND;
  const brandBaseline = yTop + 52;
  ctx.fillText(brandText, x, brandBaseline);
  x += tw + BRAND_GAP;

  ctx.fillStyle = COLOR_LINE;
  const lineY = yTop + 39;
  roundRectPath(ctx, x, lineY, DECO_LINE_W, DECO_LINE_H, 1);
  ctx.fill();
}

/**
 * @returns {Promise<void>}
 */
async function drawPosterFrame(ctx, opt) {
  const {
    palette,
    momentScore,
    streakDays,
    blind,
    qrTempPath,
    createImage,
    weekRangeText,
    logoSrc,
    logoProcessCanvas,
  } = opt;
  const accent = palette.accent;
  const cx = POSTER_W / 2;

  const g = ctx.createLinearGradient(0, 0, 0, POSTER_H);
  g.addColorStop(0, palette.bg0);
  g.addColorStop(1, palette.bg1);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, POSTER_W, POSTER_H);

  const [logoImg, qrImg] = await Promise.all([
    loadImage(createImage, logoSrc || ""),
    loadImage(createImage, qrTempPath || ""),
  ]);

  const yBrand = TOP_PAD;
  drawBrandStripCentered(ctx, cx, yBrand, logoImg, accent, g, palette, logoProcessCanvas);

  const cycleTop = TOP_PAD + LOGO_BOX + 12;
  ctx.font = "400 28px PingFang SC, sans-serif";
  ctx.fillStyle = COLOR_CYCLE;
  drawTextCenterInWidth(ctx, weekRangeText || "", MARGIN_X, TEXT_W, cycleTop + 22, COLOR_CYCLE);

  const brandBottom = cycleTop + 32;

  let cursor = brandBottom;
  const hasStatusOnlyZero = momentScore <= 0;
  if (hasStatusOnlyZero) {
    cursor += SP_BRAND_TO_STATUS;
    ctx.font = "400 32px PingFang SC, sans-serif";
    ctx.fillStyle = COLOR_STATUS;
    const lh = 32 * 1.4;
    const lines = wrapLines(ctx, ZERO_COPY, TEXT_W);
    lines.forEach((ln, i) => {
      drawTextCenterInWidth(ctx, ln, MARGIN_X, TEXT_W, cursor + 28 + i * lh, COLOR_STATUS);
    });
    cursor += lines.length * lh + SP_STATUS_TO_DATA;
  } else {
    cursor += SP_BRAND_TO_DATA_COLLAPSED;
  }

  if (momentScore >= 1) {
    ctx.font = "400 32px PingFang SC, sans-serif";
    ctx.fillStyle = COLOR_LABEL;
    drawTextCenterInWidth(ctx, "这一周，真我时刻", MARGIN_X, TEXT_W, cursor + 28, COLOR_LABEL);
    cursor += 40 + 16;
    const numStr = String(momentScore);
    const unit = "次";
    ctx.font = "700 88px DIN Alternate, PingFang SC, sans-serif";
    const wn = ctx.measureText(numStr).width;
    ctx.font = "400 36px PingFang SC, sans-serif";
    const wu = ctx.measureText(unit).width;
    const gapU = 8;
    const groupW = wn + gapU + wu;
    const startX = cx - groupW / 2;
    const numBaseline = cursor + 72;
    ctx.font = "700 88px DIN Alternate, PingFang SC, sans-serif";
    ctx.fillStyle = accent;
    ctx.fillText(numStr, startX, numBaseline);
    ctx.font = "400 36px PingFang SC, sans-serif";
    ctx.fillStyle = hexToRgba(accent, 0.3);
    ctx.fillText(unit, startX + wn + gapU, numBaseline);
    cursor += 100 + 24;
  }

  if (streakDays > 0) {
    ctx.font = "400 28px PingFang SC, sans-serif";
    ctx.fillStyle = COLOR_SECONDARY;
    const streakText = `● 已连续记录 ${streakDays} 天`;
    drawTextCenterInWidth(ctx, streakText, MARGIN_X, TEXT_W, cursor + 22, COLOR_SECONDARY);
    cursor += 36;
  }

  cursor += SP_DATA_TO_QUOTE;

  const inner = getQuoteInnerText(streakDays, blind.quoteIndex);
  cursor = drawQuoteSectionFixed(ctx, cx, cursor, inner, blind.fontStyle);

  const gapQuoteToQr = Math.max(
    SP_QUOTE_TO_QR_MIN,
    POSTER_H - BOTTOM_SAFE - TAIL_AFTER_QUOTE - cursor
  );
  cursor += gapQuoteToQr;

  ctx.font = "400 24px PingFang SC, sans-serif";
  ctx.fillStyle = COLOR_GUIDE;
  drawTextCenterInWidth(ctx, GUIDE_ABOVE_QR, MARGIN_X, TEXT_W, cursor + 22, COLOR_GUIDE);
  cursor += 28 + 16;

  const qrLeft = (POSTER_W - QR_OUTER) / 2;
  const pad = (QR_OUTER - QR_INNER) / 2;
  const ix = qrLeft + pad;
  const iy = cursor + pad;
  if (qrImg && qrImg.width) {
    ctx.save();
    roundRectPath(ctx, ix, iy, QR_INNER, QR_INNER, QR_INNER_RADIUS);
    ctx.clip();
    ctx.drawImage(qrImg, ix, iy, QR_INNER, QR_INNER);
    ctx.restore();
  } else {
    ctx.strokeStyle = "rgba(173, 181, 189, 0.65)";
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 4]);
    roundRectPath(ctx, ix + 6, iy + 6, QR_INNER - 12, QR_INNER - 12, QR_INNER_RADIUS - 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = COLOR_SECONDARY;
    ctx.font = "400 22px PingFang SC, sans-serif";
    const t = "码";
    const wm = ctx.measureText(t).width;
    ctx.fillText(t, ix + (QR_INNER - wm) / 2, iy + QR_INNER / 2 + 8);
  }

  cursor += QR_OUTER + 24;

  ctx.font = "500 30px PingFang SC, sans-serif";
  ctx.fillStyle = COLOR_CTA;
  drawTextCenterInWidth(ctx, CTA_TEXT, MARGIN_X, TEXT_W, cursor + 26, COLOR_CTA);
}

module.exports = {
  POSTER_W,
  POSTER_H,
  QUOTES,
  PALETTES,
  rollBlindBox,
  getQuoteInnerText,
  drawPosterFrame,
  hexToLineColorObj,
};
