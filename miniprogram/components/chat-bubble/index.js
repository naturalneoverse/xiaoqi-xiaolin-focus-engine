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
  },

  data: {
    arrowClass: "arrow-left",
    bubbleColor: "#7FB3D6",
    normalizedText: "",
  },

  observers: {
    "text, keepManualBreak, maxLength"(value, keepManualBreak, maxLength) {
      const next = buildBubbleText(value, keepManualBreak, maxLength);
      this.setData({ normalizedText: next });
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
      this.setData({
        arrowClass: this.properties.arrowPosition === "right" ? "arrow-right" : "arrow-left",
        bubbleColor: this.properties.color || "#7FB3D6",
        normalizedText: buildBubbleText(this.properties.text, this.properties.keepManualBreak, this.properties.maxLength),
      });
    },
  },
});
