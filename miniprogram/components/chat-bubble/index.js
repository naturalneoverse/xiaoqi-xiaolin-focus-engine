const WORD_JOINER = "\u2060";

/**
 * ChatBubble component usage rules
 * 1) Bubble only handles bubble rendering/text wrapping, no mascot binding/position.
 * 2) Mascot orientation must face bubble direction:
 *    - mascot on left + bubble on right => mascot faces right
 *    - mascot on right + bubble on left => mascot faces left
 * 3) keepManualBreak defaults to false; enable only when explicit manual line breaks are required.
 */

function sanitizeText(value, keepManualBreak) {
  const raw = value || "";
  if (keepManualBreak) {
    return raw
      .replace(/\r\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .split("\n")
      .map((line) => line.replace(/\s+/g, " ").trim())
      .join("\n")
      .trim();
  }
  return raw.replace(/\r?\n/g, " ").replace(/\s+/g, " ").trim();
}

function preventOrphanLastChar(text) {
  const chars = Array.from(text);
  if (chars.length < 3) return text;
  const last = chars[chars.length - 1];
  const prev = chars[chars.length - 2];
  if (!last || !prev || /\s/.test(last) || /\s/.test(prev)) return text;
  chars.splice(chars.length - 1, 0, WORD_JOINER);
  return chars.join("");
}

function normalizeBubbleText(value, keepManualBreak) {
  if (keepManualBreak) {
    return sanitizeText(value, true)
      .split("\n")
      .map((line) => preventOrphanLastChar(line))
      .join("\n");
  }
  return preventOrphanLastChar(sanitizeText(value, false));
}

function truncateByLength(text, maxLength) {
  const safeMax = Number(maxLength);
  if (!safeMax || safeMax <= 0) return text || "";
  const chars = Array.from(text || "");
  if (chars.length <= safeMax) return text || "";
  return `${chars.slice(0, safeMax).join("")}...`;
}

function buildBubbleText(value, keepManualBreak, maxLength) {
  const normalized = normalizeBubbleText(value, keepManualBreak);
  return truncateByLength(normalized, maxLength);
}

/** 时间编织：开场 + 正文（中间一个换行） */
function splitReportParts(text) {
  const t = String(text || "").trim();
  const i = t.indexOf("\n");
  if (i < 0) return { opening: t, body: "" };
  return {
    opening: t.slice(0, i).trim(),
    body: t.slice(i + 1).trim(),
  };
}

/** 按顿逗分号拆行，标点留在上一行末尾（时间编织报告居中展示） */
const CLAUSE_PUNCT = /[，、；]/;

function splitClausesByPunctuation(sentence) {
  const s = String(sentence || "").trim();
  if (!s) return [];
  const lines = [];
  let buf = "";
  Array.from(s).forEach((ch) => {
    buf += ch;
    if (CLAUSE_PUNCT.test(ch)) {
      lines.push(preventOrphanLastChar(buf.trim()));
      buf = "";
    }
  });
  if (buf.trim()) lines.push(preventOrphanLastChar(buf.trim()));
  return lines;
}

function buildReportDisplayLines(text) {
  const parts = splitReportParts(text);
  const lines = [];
  splitClausesByPunctuation(parts.opening).forEach((line) => lines.push(line));
  splitClausesByPunctuation(parts.body).forEach((line) => lines.push(line));
  return lines;
}

function applyTextState(comp, text, keepManualBreak, maxLength, textLayout) {
  const normalized = buildBubbleText(text, keepManualBreak, maxLength);
  if (textLayout === "center") {
    comp.setData({
      normalizedText: normalized,
      useReportBlocks: false,
      reportLines: [],
      shellLayoutClass: "",
      textLayoutClass: "bubble-text-center",
    });
    return;
  }
  const isReport = textLayout === "report";
  if (!isReport) {
    comp.setData({
      normalizedText: normalized,
      useReportBlocks: false,
      reportLines: [],
      shellLayoutClass: "",
      textLayoutClass: "",
    });
    return;
  }
  comp.setData({
    normalizedText: normalized,
    useReportBlocks: true,
    reportLines: buildReportDisplayLines(normalized),
    shellLayoutClass: "chat-bubble--report-shell",
    textLayoutClass: "bubble-text-report",
  });
}

Component({
  properties: {
    text: {
      type: String,
      value: "",
    },
    color: {
      type: String,
      value: "#7FB3D6",
    },
    arrowPosition: {
      type: String,
      value: "left",
    },
    keepManualBreak: {
      type: Boolean,
      value: false,
    },
    maxLength: {
      type: Number,
      value: 48,
    },
    /** md 默认；lg 用于任务庆祝弹窗等与图一对齐的更大气泡 */
    size: {
      type: String,
      value: "md",
    },
    /** report：时间编织报告（撑满宽度、按，、；分行居中） */
    textLayout: {
      type: String,
      value: "",
    },
  },

  data: {
    arrowClass: "arrow-left",
    bubbleColor: "#7FB3D6",
    normalizedText: "",
    sizeClass: "",
    textLayoutClass: "",
    shellLayoutClass: "",
    useReportBlocks: false,
    reportLines: [],
  },

  observers: {
    textLayout(value) {
      applyTextState(
        this,
        this.properties.text,
        this.properties.keepManualBreak,
        this.properties.maxLength,
        value,
      );
    },
    size(value) {
      this.setData({ sizeClass: value === "lg" ? "chat-bubble--lg" : "" });
    },
    "text, keepManualBreak, maxLength, textLayout"(value, keepManualBreak, maxLength, textLayout) {
      applyTextState(this, value, keepManualBreak, maxLength, textLayout);
    },
    arrowPosition(value) {
      const next = value === "right" ? "arrow-right" : "arrow-left";
      this.setData({ arrowClass: next });
    },
    color(value) {
      const nextColor = value || "#7FB3D6";
      this.setData({ bubbleColor: nextColor });
    },
  },

  lifetimes: {
    attached() {
      const size = this.properties.size;
      this.setData({
        arrowClass: this.properties.arrowPosition === "right" ? "arrow-right" : "arrow-left",
        bubbleColor: this.properties.color || "#7FB3D6",
        sizeClass: size === "lg" ? "chat-bubble--lg" : "",
      });
      applyTextState(
        this,
        this.properties.text,
        this.properties.keepManualBreak,
        this.properties.maxLength,
        this.properties.textLayout,
      );
    },
  },
});
