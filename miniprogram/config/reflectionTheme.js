/** 哲思复盘页：背景渐变与导航栏色（与 PRD 一致） */

const NAV_BAR_BG = "#EFF7FD";
const PAGE_GRADIENT = "linear-gradient(180deg, #EFF7FD 0%, #E1F0FA 50%, #D6EBF7 100%)";

const QUADRANT_CARD_BG_ALPHA = 0.3;
/** 已提交：渐变叠加强度（默认 0.30 → 0.72，配合 4 倍饱和度） */
const QUADRANT_CARD_BG_ALPHA_COMPLETED = 0.72;

const QUADRANT_CARD_STOPS = {
  1: [
    [239, 247, 253],
    [214, 235, 247],
  ],
  2: [
    [245, 240, 250],
    [232, 223, 245],
  ],
  3: [
    [242, 248, 242],
    [216, 237, 216],
  ],
  4: [
    [253, 247, 240],
    [245, 232, 216],
  ],
};

/** 已提交卡片 HSL 饱和度倍数（用户要求 3–5 倍，取 4） */
const COMPLETED_SATURATE_FACTOR = 4;

function clamp01(v) {
  return Math.min(1, Math.max(0, v));
}

function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      default:
        h = ((r - g) / d + 4) / 6;
    }
  }
  return [h * 360, s, l];
}

function hslToRgb(h, s, l) {
  h /= 360;
  let r;
  let g;
  let b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p, q, t) => {
      let tt = t;
      if (tt < 0) tt += 1;
      if (tt > 1) tt -= 1;
      if (tt < 1 / 6) return p + (q - p) * 6 * tt;
      if (tt < 1 / 2) return q;
      if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

/** 已提交：HSL 饱和度 × satFactor；近白色注入足够色相，否则 4 倍仍看不出 */
function intensifyRgb(r, g, b, satFactor) {
  const factor = Math.max(1, satFactor);
  const [h, s, l] = rgbToHsl(r, g, b);
  let nextS;
  let nextL;
  if (s < 0.2) {
    nextS = clamp01(0.12 + 0.22 * (factor / 4));
    nextL = clamp01(l - 0.04 - 0.012 * (factor - 1));
  } else {
    nextS = clamp01(Math.min(0.88, s * factor));
    nextL = clamp01(l - 0.02 * (factor - 1));
  }
  return hslToRgb(h, nextS, nextL);
}

function buildQuadrantGradient(stops, alpha, satFactor) {
  const [r1, g1, b1] = intensifyRgb(stops[0][0], stops[0][1], stops[0][2], satFactor);
  const [r2, g2, b2] = intensifyRgb(stops[1][0], stops[1][1], stops[1][2], satFactor);
  const a = Math.round(alpha * 100) / 100;
  return `linear-gradient(135deg, rgba(${r1},${g1},${b1},${a}) 0%, rgba(${r2},${g2},${b2},${a}) 100%)`;
}

const QUADRANT_CARD_BGS = {};
const QUADRANT_CARD_BGS_COMPLETED = {};

[1, 2, 3, 4].forEach((id) => {
  const stops = QUADRANT_CARD_STOPS[id];
  QUADRANT_CARD_BGS[id] = buildQuadrantGradient(stops, QUADRANT_CARD_BG_ALPHA, 1);
  QUADRANT_CARD_BGS_COMPLETED[id] = buildQuadrantGradient(
    stops,
    QUADRANT_CARD_BG_ALPHA_COMPLETED,
    COMPLETED_SATURATE_FACTOR,
  );
});

function getQuadrantCardBg(quadrantId, completed) {
  const id = Number(quadrantId);
  const map = completed ? QUADRANT_CARD_BGS_COMPLETED : QUADRANT_CARD_BGS;
  return map[id] || QUADRANT_CARD_BGS[1];
}

const QUADRANT_OPTION_SELECTED_BG = {
  1: "linear-gradient(135deg, rgba(239,247,253,0.60) 0%, rgba(214,235,247,0.60) 100%)",
  2: "linear-gradient(135deg, rgba(245,240,250,0.60) 0%, rgba(232,223,245,0.60) 100%)",
  3: "linear-gradient(135deg, rgba(242,248,242,0.60) 0%, rgba(216,237,216,0.60) 100%)",
  4: "linear-gradient(135deg, rgba(253,247,240,0.60) 0%, rgba(245,232,216,0.60) 100%)",
};

/** 结语气泡边框色（与 PRD 象限色系一致） */
const QUADRANT_BUBBLE_COLORS = {
  1: "#b7d6ea",
  2: "#d4c4e8",
  3: "#c5ddc5",
  4: "#f0dcc8",
};

function getQuadrantBubbleColor(quadrantId) {
  return QUADRANT_BUBBLE_COLORS[Number(quadrantId)] || QUADRANT_BUBBLE_COLORS[1];
}

function getQuadrantOptionSelectedBg(quadrantId) {
  return QUADRANT_OPTION_SELECTED_BG[Number(quadrantId)] || QUADRANT_OPTION_SELECTED_BG[1];
}

const QUADRANT_META = {
  1: {
    title: "观实归真",
    subtitle: "放下预设，看见真实",
    agentLabel: "小麟·觉察",
    agent: "xiaolin",
    accent: "#12598F",
  },
  2: {
    title: "观心明己",
    subtitle: "在困境里，听见自己",
    agentLabel: "小麟·觉醒",
    agent: "xiaolin",
    accent: "#6B4C8A",
  },
  3: {
    title: "明辨本心",
    subtitle: "分清课题，找回节奏",
    agentLabel: "小麒·解绑",
    agent: "xiaoqi",
    accent: "#2E6B3E",
  },
  4: {
    title: "踏实前行",
    subtitle: "最小一步，从看见到行动",
    agentLabel: "小麒·行动",
    agent: "xiaoqi",
    accent: "#C0713B",
  },
};

function getQuadrantMeta(quadrantId) {
  const n = Number(quadrantId);
  return QUADRANT_META[n] || null;
}

function applyReflectionNavBar() {
  try {
    wx.setNavigationBarColor({
      frontColor: "#000000",
      backgroundColor: NAV_BAR_BG,
      animation: { duration: 0, timingFunc: "linear" },
    });
  } catch (e) {
    /* ignore */
  }
}

module.exports = {
  NAV_BAR_BG,
  PAGE_GRADIENT,
  QUADRANT_CARD_BGS,
  QUADRANT_CARD_BGS_COMPLETED,
  QUADRANT_CARD_BG_ALPHA,
  QUADRANT_CARD_BG_ALPHA_COMPLETED,
  getQuadrantCardBg,
  QUADRANT_OPTION_SELECTED_BG,
  QUADRANT_BUBBLE_COLORS,
  QUADRANT_META,
  getQuadrantMeta,
  getQuadrantOptionSelectedBg,
  getQuadrantBubbleColor,
  applyReflectionNavBar,
};
