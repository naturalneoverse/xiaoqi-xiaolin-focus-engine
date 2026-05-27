const {
  QUADRANT_CARD_STOPS,
  QUADRANT_CARD_BG_ALPHA,
  QUADRANT_CARD_BG_ALPHA_COMPLETED,
} = require("../config/reflectionTheme");

const CANVAS_W = 750;
const MARGIN_X = 40;
const CONTENT_W = CANVAS_W - MARGIN_X * 2;
const SECTION_GAP = 28;
const FOOT_H = 56;

const COLOR_PAGE_TOP = "#EFF7FD";
const COLOR_PAGE_MID = "#E1F0FA";
const COLOR_PAGE_BOTTOM = "#D6EBF7";
const COLOR_TASK = "#184061";
const COLOR_MUTED = "#8A9CB0";
const COLOR_SUB = "#577388";
const COLOR_ANSWER = "#2A4A62";
const COLOR_BRAND = "#8A9CB0";

function wrapLines(ctx, text, maxWidth) {
  const s = String(text || "").trim();
  if (!s) return [];
  const chars = Array.from(s);
  const lines = [];
  let line = "";
  chars.forEach((ch) => {
    const test = line + ch;
    if (ch === "\n") {
      lines.push(line);
      line = "";
      return;
    }
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = ch;
    } else {
      line = test;
    }
  });
  if (line) lines.push(line);
  return lines.length ? lines : [];
}

function lineHeight(fontSize, ratio) {
  return Math.ceil(fontSize * (ratio || 1.45));
}

function sectionFillColor(quadrantId, filled) {
  const stops = QUADRANT_CARD_STOPS[Number(quadrantId)] || QUADRANT_CARD_STOPS[1];
  const rgb = stops[filled ? 1 : 0];
  const alpha = filled ? QUADRANT_CARD_BG_ALPHA_COMPLETED : QUADRANT_CARD_BG_ALPHA;
  return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`;
}

function measureSection(ctx, section, innerW) {
  let h = 28 + 16;
  ctx.font = "500 32px sans-serif";
  h += lineHeight(32);
  if (section.subtitle) {
    ctx.font = "400 24px sans-serif";
    h += 8 + lineHeight(24);
  }
  if (section.filled && section.completedAt) {
    ctx.font = "400 20px sans-serif";
    h += 8 + lineHeight(20);
  }
  h += 12;

  if (!section.filled || !section.echoParagraphs || !section.echoParagraphs.length) {
    ctx.font = "400 26px sans-serif";
    h += lineHeight(26);
  } else {
    section.echoParagraphs.forEach((para) => {
      ctx.font = "400 26px sans-serif";
      const ptext =
        typeof para === "string"
          ? para
          : para && typeof para.echoText === "string"
            ? para.echoText
            : para && typeof para.text === "string"
              ? para.text
              : "";
      wrapLines(ctx, ptext, innerW).forEach(() => {
        h += lineHeight(26, 1.55);
      });
      h += 12;
    });
    h -= 12;
  }
  return h + 28;
}

function measureComboLine(ctx, text, maxW, fontSize) {
  const s = String(text || "").trim();
  if (!s) return 0;
  let h = 12;
  ctx.font = `400 ${fontSize}px sans-serif`;
  wrapLines(ctx, s, maxW).forEach(() => {
    h += lineHeight(fontSize);
  });
  return h + 16;
}

function measureClosingBlock(ctx, paragraphs, innerW) {
  let h = 28 + 16;
  ctx.font = "500 32px sans-serif";
  h += lineHeight(32);
  h += 12;
  (paragraphs || []).forEach((para) => {
    ctx.font = "400 26px sans-serif";
    wrapLines(ctx, para, innerW).forEach(() => {
      h += lineHeight(26, 1.55);
    });
    h += 12;
  });
  h -= 12;
  return h + 28;
}

function measureReportHeight(ctx, vm) {
  const innerW = CONTENT_W - 56;
  let h = 48;
  ctx.font = "500 34px sans-serif";
  wrapLines(ctx, vm.taskTitle, CONTENT_W).forEach(() => {
    h += lineHeight(34);
  });
  if (vm.reportTime) {
    h += 12;
    ctx.font = "400 22px sans-serif";
    h += lineHeight(22);
  }
  h += 16;
  if (vm.reportIntro) {
    h += measureComboLine(ctx, vm.reportIntro, CONTENT_W, 24);
  }
  (vm.sections || []).forEach((section) => {
    h += measureSection(ctx, section, innerW);
    h += SECTION_GAP;
  });
  if (vm.generalEcho && vm.generalEcho.length) {
    h += measureClosingBlock(ctx, vm.generalEcho, innerW);
    h += SECTION_GAP;
  }
  if (vm.reportOutro) {
    h += measureComboLine(ctx, vm.reportOutro, CONTENT_W, 22);
  }
  h += FOOT_H + 48;
  return Math.max(h, 960);
}

function drawRoundedRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function drawPageBackground(ctx, totalH) {
  const grad = ctx.createLinearGradient(0, 0, 0, totalH);
  grad.addColorStop(0, COLOR_PAGE_TOP);
  grad.addColorStop(0.5, COLOR_PAGE_MID);
  grad.addColorStop(1, COLOR_PAGE_BOTTOM);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CANVAS_W, totalH);
}

function drawHead(ctx, vm, startY) {
  let y = startY;
  ctx.fillStyle = COLOR_TASK;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.font = "500 34px sans-serif";
  wrapLines(ctx, vm.taskTitle, CONTENT_W).forEach((ln) => {
    ctx.fillText(ln, CANVAS_W / 2, y);
    y += lineHeight(34);
  });
  if (vm.reportTime) {
    y += 12;
    ctx.fillStyle = COLOR_MUTED;
    ctx.font = "400 22px sans-serif";
    ctx.fillText(`最近复盘 · ${vm.reportTime}`, CANVAS_W / 2, y);
    y += lineHeight(22);
  }
  return y + 16;
}

function drawComboLine(ctx, text, y, maxW, fontSize, color) {
  const s = String(text || "").trim();
  if (!s) return y;
  y += 12;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillStyle = color;
  ctx.font = `400 ${fontSize}px sans-serif`;
  wrapLines(ctx, s, maxW).forEach((ln) => {
    ctx.fillText(ln, CANVAS_W / 2, y);
    y += lineHeight(fontSize);
  });
  ctx.textAlign = "left";
  return y + 16;
}

function drawSection(ctx, section, y, innerW) {
  const x = MARGIN_X;
  const w = CONTENT_W;
  const blockH = measureSection(ctx, section, innerW);
  drawRoundedRect(ctx, x, y, w, blockH, 24);
  ctx.fillStyle = sectionFillColor(section.id, section.filled);
  ctx.fill();
  ctx.strokeStyle = `rgba(255,255,255,${QUADRANT_CARD_BG_ALPHA})`;
  ctx.lineWidth = 2;
  ctx.stroke();

  let cy = y + 28;
  const px = x + 28;
  const textW = w - 56;

  ctx.textAlign = "left";
  ctx.fillStyle = section.accent || COLOR_TASK;
  ctx.font = "500 32px sans-serif";
  ctx.fillText(section.title, px, cy);
  if (section.agentLabel) {
    ctx.textAlign = "right";
    ctx.fillStyle = COLOR_MUTED;
    ctx.font = "400 20px sans-serif";
    ctx.fillText(section.agentLabel, px + textW, cy + 4);
    ctx.textAlign = "left";
  }
  cy += lineHeight(32);

  if (section.subtitle) {
    cy += 8;
    ctx.fillStyle = COLOR_SUB;
    ctx.font = "400 24px sans-serif";
    ctx.fillText(section.subtitle, px, cy);
    cy += lineHeight(24);
  }
  if (section.filled && section.completedAt) {
    cy += 8;
    ctx.fillStyle = COLOR_MUTED;
    ctx.font = "400 20px sans-serif";
    ctx.fillText(section.completedAt, px, cy);
    cy += lineHeight(20);
  }
  cy += 12;

  if (!section.filled || !section.echoParagraphs || !section.echoParagraphs.length) {
    ctx.fillStyle = COLOR_MUTED;
    ctx.font = "400 26px sans-serif";
    ctx.fillText(section.emptyLabel || "暂未填写", px, cy);
    return y + blockH;
  }

  section.echoParagraphs.forEach((para) => {
    ctx.fillStyle = COLOR_ANSWER;
    ctx.font = "400 26px sans-serif";
    const ptext =
      typeof para === "string"
        ? para
        : para && typeof para.echoText === "string"
          ? para.echoText
          : para && typeof para.text === "string"
            ? para.text
            : "";
    wrapLines(ctx, ptext, textW).forEach((ln) => {
      ctx.fillText(ln, px, cy);
      cy += lineHeight(26, 1.55);
    });
    cy += 12;
  });

  return y + blockH;
}

function drawClosingBlock(ctx, paragraphs, y, innerW) {
  const x = MARGIN_X;
  const w = CONTENT_W;
  const blockH = measureClosingBlock(ctx, paragraphs, innerW);
  drawRoundedRect(ctx, x, y, w, blockH, 24);
  ctx.fillStyle = `rgba(255,255,255,${QUADRANT_CARD_BG_ALPHA})`;
  ctx.fill();
  ctx.strokeStyle = `rgba(255,255,255,${QUADRANT_CARD_BG_ALPHA})`;
  ctx.lineWidth = 2;
  ctx.stroke();

  let cy = y + 28;
  const px = x + 28;
  const textW = w - 56;

  ctx.textAlign = "left";
  ctx.fillStyle = "#12598f";
  ctx.font = "500 32px sans-serif";
  ctx.fillText("整卷回响", px, cy);
  cy += lineHeight(32);
  cy += 12;

  (paragraphs || []).forEach((para) => {
    ctx.fillStyle = "#334d62";
    ctx.font = "400 26px sans-serif";
    wrapLines(ctx, para, textW).forEach((ln) => {
      ctx.fillText(ln, px, cy);
      cy += lineHeight(26, 1.55);
    });
    cy += 12;
  });

  return y + blockH;
}

function drawFooter(ctx, y) {
  ctx.textAlign = "center";
  ctx.fillStyle = COLOR_BRAND;
  ctx.font = "400 22px sans-serif";
  ctx.fillText("小麒小麟专注引擎 · 哲学回响", CANVAS_W / 2, y);
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ taskTitle: string, reportTime: string, sections: object[] }} vm
 * @returns {number} total height
 */
function drawReport(ctx, vm) {
  const totalH = measureReportHeight(ctx, vm);
  drawPageBackground(ctx, totalH);
  let y = drawHead(ctx, vm, 48);
  if (vm.reportIntro) {
    y = drawComboLine(ctx, vm.reportIntro, y, CONTENT_W, 24, COLOR_SUB);
  }
  (vm.sections || []).forEach((section) => {
    y = drawSection(ctx, section, y, CONTENT_W - 56);
    y += SECTION_GAP;
  });
  if (vm.generalEcho && vm.generalEcho.length) {
    y = drawClosingBlock(ctx, vm.generalEcho, y, CONTENT_W - 56);
    y += SECTION_GAP;
  }
  if (vm.reportOutro) {
    y = drawComboLine(ctx, vm.reportOutro, y, CONTENT_W, 22, COLOR_MUTED);
  }
  drawFooter(ctx, y + 8);
  return totalH;
}

/**
 * @param {object} pageCtx - 小程序 Page 实例
 * @param {{ taskTitle: string, reportTime: string, sections: object[] }} vm
 * @returns {Promise<string>} temp file path
 */
function exportReportImage(pageCtx, vm) {
  return new Promise((resolve, reject) => {
    const query = wx.createSelectorQuery().in(pageCtx);
    query
      .select("#reflectionReportCanvas")
      .fields({ node: true, size: true })
      .exec((res) => {
        const first = res && res[0];
        if (!first || !first.node) {
          reject(new Error("canvas not ready"));
          return;
        }
        const canvas = first.node;
        const dpr = wx.getSystemInfoSync().pixelRatio || 2;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("canvas context missing"));
          return;
        }

        const logicalH = measureReportHeight(ctx, vm);
        canvas.width = CANVAS_W * dpr;
        canvas.height = logicalH * dpr;
        ctx.scale(dpr, dpr);
        drawReport(ctx, vm);

        wx.canvasToTempFilePath(
          {
            canvas,
            fileType: "png",
            quality: 1,
            width: canvas.width,
            height: canvas.height,
            destWidth: canvas.width,
            destHeight: canvas.height,
            success: (r) => resolve(r.tempFilePath),
            fail: (err) => reject(err),
          },
          pageCtx,
        );
      });
  });
}

function saveImageToAlbum(filePath) {
  return new Promise((resolve, reject) => {
    wx.saveImageToPhotosAlbum({
      filePath,
      success: resolve,
      fail: reject,
    });
  });
}

module.exports = {
  CANVAS_W,
  measureReportHeight,
  drawReport,
  exportReportImage,
  saveImageToAlbum,
};
