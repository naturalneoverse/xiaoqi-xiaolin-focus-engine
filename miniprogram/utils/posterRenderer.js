/**
 * 真我时刻海报：逻辑画布固定 1080×1920（9:16）；背景多套渐变盲盒 + accent；可选 cloudFileId 云底图；金句与字体盲盒随机。
 * 导出：整幅 1080×1920 PNG；物理尺寸 = 逻辑 × devicePixelRatio。
 */

const POSTER_W = 1080;
const POSTER_H = 1920;
const MARGIN_X = 60;
const TEXT_W = POSTER_W - MARGIN_X * 2;

/** 顶组内相邻块最小间距 */
const TOP_GROUP_GAP_MIN = 8;
/** 底组：引导 ↔ 码、码 ↔ CTA 固定间距 */
const BOTTOM_GROUP_GAP = 10;
/** 小程序码与底部文案相对原位置整体下移（约等于 CTA 一行行距，30px 字号 ×1.2） */
const BOTTOM_QR_SECTION_DROP = 36;
/** 顶部正文区上缘距画布顶（已无顶栏 Logo） */
const TOP_PAD = 100;
/** 画布底至底组最下沿留白 */
const BOTTOM_SAFE = 110;
/** 中间带 M 内：上留白 10%、中间带目标区 80%、下留白 10%（与 M_TOP_FR + M_MID_FR 互补） */
const M_TOP_FR = 0.1;
const M_MID_FR = 0.8;
/** 中间正文区相对卡片占位的高度边距（无底块时保持 0） */
const CARD_PAD_X = 0;
const CARD_PAD_Y = 0;
/** 金句与上一块间距（取代原 SP_DATA_TO_QUOTE） */
const GAP_BEFORE_QUOTE = 8;

/** 中间卡片内文案整体缩放（字号与配套间距同步；底码与 CTA 不变） */
const MID_TEXT_SCALE = 1.2;
function mid(n) {
  return Math.round(n * MID_TEXT_SCALE);
}

const COLOR_STATUS = "#4A4A4A";
const COLOR_LABEL = "#7F8C8D";
/** 暮光紫 / 深海蓝底图：仅「这一周，真我时刻」行，字号与位置不变 */
const COLOR_WEEK_MOMENT_LINE = "rgba(122, 138, 149, 0.9)";
const WEEK_MOMENT_LINE_THEME_IDS = new Set(["mu-guang-zi-die", "mu-guang-zi-yu", "shen-hai-lan-die", "shen-hai-lan-yu"]);
const COLOR_SECONDARY = "#95A5A6";
const COLOR_QUOTE_BODY = "#2C3E50";
const COLOR_QUOTE_MARK = "#D5D8DC";
const COLOR_CTA = "#2C3E50";

const { POSTER_THEMES } = require("../config/posterThemes.js");
/** 盲盒主题（渐变 + 可选 image 底图）；与 design/parts 十六套一一对应 */
const PALETTES = POSTER_THEMES;

const QUOTES = [
  "你编织的，不是时间，是自己。",
  "人不是其所是，是其所不是。",
  "每一次开始，都是一次诞生。",
  "你看见时间的那一刻，时间才属于你。",
  "成为自己，是唯一值得做的事。",
  "边界不是终点，是开始的起点。",
  "劳动为了生存，工作为了世界，\n行动为了成为。",
  "向死而生，每一天都是选择。",
  "真正的自由，是说\"不\"的能力。",
  "你此刻在哪里，你就活在哪里。",
  "不二，自他一体。",
  "合一，便是完整。",
  "你的时间质地，就是你的生命质地。",
  "记下你要做的，时间就有了形状。",
  "宽恕过去，才能开始未来。",
];

const MILESTONE_21 = "已累计打卡21天，你活成了自己选择的样子";
const ZERO_COPY = "这一周，为生存和责任奔波，辛苦了。";
const CTA_TEXT = "扫我，看看你有多少真我时刻 →";

const QR_OUTER = 240;
const QR_INNER = 200;
const QR_RADIUS = 18;
const QR_INNER_RADIUS = 11;

/** 底组总高：码外框 + 间距 + CTA 块（已去掉二维码上方引导文案） */
const BOTTOM_BLOCK_H = QR_OUTER + BOTTOM_GROUP_GAP + 48;

function rollBlindBox() {
  return {
    paletteIndex: Math.floor(Math.random() * PALETTES.length),
    quoteIndex: Math.floor(Math.random() * QUOTES.length),
    fontStyle: Math.random() < 0.5 ? 0 : 1,
  };
}

function getQuoteInnerText(totalCheckInDays, quoteIndex) {
  if (totalCheckInDays >= 21) return MILESTONE_21;
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

/** 顶行「这一周，真我时刻」：仅暮光紫 / 深海蓝四套底图换色，其余主题仍用 COLOR_LABEL */
function colorForWeekMomentLine(palette) {
  const id = palette && palette.id;
  if (id && WEEK_MOMENT_LINE_THEME_IDS.has(id)) return COLOR_WEEK_MOMENT_LINE;
  return COLOR_LABEL;
}

/** 先按 `\n` 强制断行，再在各行内按宽度折行（避免金句孤字） */
function wrapLines(ctx, text, maxWidth) {
  const segments = String(text).split("\n");
  const lines = [];
  segments.forEach((segment, si) => {
    if (segment === "") {
      if (si > 0) lines.push("");
      return;
    }
    const chars = segment.split("");
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
  });
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
  if (n <= 18) return mid(38);
  if (n <= 26) return mid(34);
  return mid(30);
}

function bodyFontForStyle(fontStyle, sizePx) {
  if (fontStyle === 0) return `500 ${sizePx}px STSong, Songti SC, Georgia, serif`;
  return `500 ${sizePx}px PingFang SC, Helvetica Neue, sans-serif`;
}

/** 无强制换行时优先缩字号至单行容纳，避免末字/标点孤行 */
function resolveQuoteBodyLayout(ctx, innerText, fontStyle) {
  const bodyMaxW = TEXT_W - mid(140);
  const text = String(innerText);
  let sizePx = quoteBodyFontSize(text);
  const minPx = mid(24);

  if (!text.includes("\n")) {
    while (sizePx >= minPx) {
      ctx.font = bodyFontForStyle(fontStyle, sizePx);
      if (ctx.measureText(text).width <= bodyMaxW) {
        return { sizePx, bodyLines: [text] };
      }
      sizePx -= 2;
    }
  }

  ctx.font = bodyFontForStyle(fontStyle, sizePx);
  return { sizePx, bodyLines: wrapLines(ctx, text, bodyMaxW) };
}

/** 方案 C1：弯引号用宋体/Georgia 栈，与正文块整体水平居中 */
function drawQuoteSectionFixed(ctx, cx, yStart, innerText, fontStyle) {
  const markPx = mid(68);
  const markFont = `400 ${markPx}px "Songti SC", STSong, STKaiti, "Kaiti SC", Georgia, "Times New Roman", serif`;
  const { sizePx, bodyLines } = resolveQuoteBodyLayout(ctx, innerText, fontStyle);
  const lh = sizePx * 1.5;
  const bodyFont = bodyFontForStyle(fontStyle, sizePx);
  const innerGap = mid(10);

  ctx.font = markFont;
  const qwL = ctx.measureText("「").width;
  const qwR = ctx.measureText("」").width;

  ctx.font = bodyFont;
  let maxW = 0;
  bodyLines.forEach((ln) => {
    const w = ctx.measureText(ln).width;
    if (w > maxW) maxW = w;
  });

  const bodyBlockW = maxW;
  const totalW = qwL + innerGap + bodyBlockW + innerGap + qwR;
  const blockStart = cx - totalW / 2;
  const topPad = Math.max(0, (bodyLines.length * lh - markPx) / 2);
  const quoteTop = yStart + topPad;
  const markBaseline = quoteTop + mid(56);

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

  return quoteTop + mid(56) + bodyLines.length * lh + mid(28);
}

/** 不绘制，仅量金句块高度（与 drawQuoteSectionFixed 一致，行高 1.5） */
function measureQuoteBlockHeight(ctx, innerText, fontStyle) {
  const markPx = mid(68);
  const { sizePx, bodyLines } = resolveQuoteBodyLayout(ctx, innerText, fontStyle);
  const lh = sizePx * 1.5;
  const topPad = Math.max(0, (bodyLines.length * lh - markPx) / 2);
  return topPad + mid(56) + bodyLines.length * lh + mid(28);
}

/** 有分：中间卡片内正文区高度（不含卡片上下 CARD_PAD_Y） */
function measureScoreCardBodyHeight(ctx, streakDays, innerText, fontStyle) {
  const streakH = streakDays > 0 ? mid(36) : 0;
  const quoteH = measureQuoteBlockHeight(ctx, innerText, fontStyle);
  return mid(180) + streakH + mid(GAP_BEFORE_QUOTE) + quoteH;
}

/** 零分：中间卡片内正文区高度（32px 字、行高 1.5） */
function measureZeroCardBodyHeight(ctx) {
  const fz = mid(32);
  ctx.font = `400 ${fz}px PingFang SC, sans-serif`;
  const innerW = TEXT_W - 2 * CARD_PAD_X;
  const lines = wrapLines(ctx, ZERO_COPY, innerW);
  const lh = fz * 1.5;
  return mid(28) + lines.length * lh + mid(24);
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

/** 底图铺满逻辑画布（等同 CSS object-fit: cover） */
function drawBackgroundImageCover(ctx, img, cw, ch) {
  if (!img || !img.width) return;
  const sw = img.width;
  const sh = img.height;
  const scale = Math.max(cw / sw, ch / sh);
  const dw = sw * scale;
  const dh = sh * scale;
  const dx = (cw - dw) / 2;
  const dy = (ch - dh) / 2;
  ctx.drawImage(img, dx, dy, dw, dh);
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
  } = opt;
  const accent = palette.accent;
  const cx = POSTER_W / 2;

  const g = ctx.createLinearGradient(0, 0, 0, POSTER_H);
  g.addColorStop(0, palette.bg0);
  g.addColorStop(1, palette.bg1);

  const bgSrc = palette.image && String(palette.image).trim();
  const [bgImg, qrImg] = await Promise.all([
    loadImage(createImage, bgSrc || ""),
    loadImage(createImage, qrTempPath || ""),
  ]);

  if (bgImg && bgImg.width) {
    drawBackgroundImageCover(ctx, bgImg, POSTER_W, POSTER_H);
  } else {
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, POSTER_W, POSTER_H);
  }

  const yAfterTop = TOP_PAD + TOP_GROUP_GAP_MIN;

  const yBottomTop = POSTER_H - BOTTOM_SAFE - BOTTOM_BLOCK_H;
  const hM = Math.max(120, yBottomTop - yAfterTop - BOTTOM_QR_SECTION_DROP);

  const inner = getQuoteInnerText(streakDays, blind.quoteIndex);
  const bodyH =
    momentScore <= 0
      ? measureZeroCardBodyHeight(ctx)
      : measureScoreCardBodyHeight(ctx, streakDays, inner, blind.fontStyle);
  const hContent = bodyH + 2 * CARD_PAD_Y;
  const hSlot = M_MID_FR * hM;
  const ySlotTop = yAfterTop + M_TOP_FR * hM;
  let yCard;
  if (hContent <= hSlot) {
    yCard = ySlotTop + (hSlot - hContent) / 2;
  } else if (hContent <= hM) {
    yCard = yAfterTop + (hM - hContent) / 2;
  } else {
    yCard = yAfterTop;
  }

  const innerTop = yCard + CARD_PAD_Y;
  if (momentScore <= 0) {
    const zf = mid(32);
    ctx.font = `400 ${zf}px PingFang SC, sans-serif`;
    ctx.fillStyle = COLOR_STATUS;
    const innerW = TEXT_W - 2 * CARD_PAD_X;
    const lines = wrapLines(ctx, ZERO_COPY, innerW);
    const zlh = zf * 1.5;
    lines.forEach((ln, i) => {
      drawTextCenterInWidth(ctx, ln, MARGIN_X, innerW, innerTop + mid(28) + i * zlh, COLOR_STATUS);
    });
  } else {
    let cur = innerTop;
    ctx.font = `400 ${mid(32)}px PingFang SC, sans-serif`;
    drawTextCenterInWidth(
      ctx,
      "这一周，真我时刻",
      MARGIN_X,
      TEXT_W,
      cur + mid(28),
      colorForWeekMomentLine(palette)
    );
    cur += mid(56);
    const numStr = String(momentScore);
    const unit = "次";
    ctx.font = `700 ${mid(88)}px DIN Alternate, PingFang SC, sans-serif`;
    const wn = ctx.measureText(numStr).width;
    ctx.font = `400 ${mid(36)}px PingFang SC, sans-serif`;
    const wu = ctx.measureText(unit).width;
    const gapU = mid(8);
    const groupW = wn + gapU + wu;
    const startX = cx - groupW / 2;
    const numBaseline = cur + mid(72);
    ctx.font = `700 ${mid(88)}px DIN Alternate, PingFang SC, sans-serif`;
    ctx.fillStyle = accent;
    ctx.fillText(numStr, startX, numBaseline);
    ctx.font = `400 ${mid(36)}px PingFang SC, sans-serif`;
    ctx.fillStyle = hexToRgba(accent, 0.3);
    ctx.fillText(unit, startX + wn + gapU, numBaseline);
    cur += mid(124);
    if (streakDays > 0) {
      ctx.font = `400 ${mid(28)}px PingFang SC, sans-serif`;
      ctx.fillStyle = COLOR_SECONDARY;
      const streakText = `● 已累计打卡 ${streakDays} 天`;
      drawTextCenterInWidth(ctx, streakText, MARGIN_X, TEXT_W, cur + mid(22), COLOR_SECONDARY);
      cur += mid(36);
    }
    cur += mid(GAP_BEFORE_QUOTE);
    drawQuoteSectionFixed(ctx, cx, cur, inner, blind.fontStyle);
  }

  let yBot = yBottomTop + BOTTOM_QR_SECTION_DROP;

  const qrLeft = (POSTER_W - QR_OUTER) / 2;
  const pad = (QR_OUTER - QR_INNER) / 2;
  const ix = qrLeft + pad;
  const iyQr = yBot + pad;
  if (qrImg && qrImg.width) {
    ctx.save();
    roundRectPath(ctx, ix, iyQr, QR_INNER, QR_INNER, QR_INNER_RADIUS);
    ctx.clip();
    ctx.drawImage(qrImg, ix, iyQr, QR_INNER, QR_INNER);
    ctx.restore();
  } else {
    ctx.strokeStyle = "rgba(173, 181, 189, 0.65)";
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 4]);
    roundRectPath(ctx, ix + 6, iyQr + 6, QR_INNER - 12, QR_INNER - 12, QR_INNER_RADIUS - 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = COLOR_SECONDARY;
    ctx.font = "400 22px PingFang SC, sans-serif";
    const t = "码";
    const wm = ctx.measureText(t).width;
    ctx.fillText(t, ix + (QR_INNER - wm) / 2, iyQr + QR_INNER / 2 + 8);
  }
  yBot += QR_OUTER + BOTTOM_GROUP_GAP;

  ctx.font = "500 30px PingFang SC, sans-serif";
  ctx.fillStyle = COLOR_CTA;
  drawTextCenterInWidth(ctx, CTA_TEXT, MARGIN_X, TEXT_W, yBot + 26, COLOR_CTA);
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
