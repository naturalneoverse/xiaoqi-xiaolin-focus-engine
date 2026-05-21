"use strict";

const https = require("https");
const { URL } = require("url");
const { ARK_TIMEOUT_MS, ARK_MAX_RETRIES, ARK_MAX_OUTPUT_TOKENS } = require("./constants");
const { logEvent } = require("./logger");

/**
 * 从方舟 Responses 多种返回形态提取正文
 * @param {object} arkResponse
 * @returns {string}
 */
function extractReplyText(arkResponse) {
  if (!arkResponse || typeof arkResponse !== "object") return "";

  if (typeof arkResponse.output_text === "string" && arkResponse.output_text.trim()) {
    return arkResponse.output_text.trim();
  }

  const output = arkResponse.output;
  if (typeof output === "string" && output.trim()) return output.trim();

  if (Array.isArray(output)) {
    for (let i = output.length - 1; i >= 0; i--) {
      const item = output[i];
      if (!item) continue;
      if (typeof item.text === "string" && item.text.trim()) return item.text.trim();
      if (item.type === "message" && Array.isArray(item.content)) {
        for (let j = item.content.length - 1; j >= 0; j--) {
          const part = item.content[j];
          if (!part) continue;
          if (typeof part.text === "string" && part.text.trim()) return part.text.trim();
          if (typeof part === "string" && part.trim()) return part.trim();
        }
      }
    }
  }

  const choices = arkResponse.choices;
  if (Array.isArray(choices) && choices[0]) {
    const msg = choices[0].message;
    if (msg && typeof msg.content === "string" && msg.content.trim()) return msg.content.trim();
  }

  return "";
}

/**
 * @param {string} url
 * @param {object} headers
 * @param {object} body
 * @param {number} timeoutMs
 * @returns {Promise<{ statusCode: number, body: string }>}
 */
function postJson(url, headers, body, timeoutMs) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const payload = JSON.stringify(body);
    const req = https.request(
      {
        hostname: u.hostname,
        port: u.port || 443,
        path: `${u.pathname}${u.search}`,
        method: "POST",
        headers: Object.assign({}, headers, {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
        }),
        timeout: timeoutMs,
      },
      (res) => {
        let chunks = "";
        res.setEncoding("utf8");
        res.on("data", (c) => {
          chunks += c;
        });
        res.on("end", () => {
          resolve({ statusCode: res.statusCode || 0, body: chunks });
        });
      },
    );
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("ARK_TIMEOUT"));
    });
    req.on("error", (err) => reject(err));
    if (typeof req.setTimeout === "function") {
      req.setTimeout(timeoutMs, () => {
        req.destroy();
        reject(new Error("ARK_TIMEOUT"));
      });
    }
    req.write(payload);
    req.end();
  });
}

function isRetryableStatus(code) {
  return code === 408 || code === 429 || code >= 500;
}

/**
 * @param {{ responsesUrl: string, apiKey: string, modelId: string }} env
 * @param {{ instructions: string, userContent: string, meta?: object }} params
 * @returns {Promise<{ ok: boolean, text?: string, errCode?: string, httpStatus?: number }>}
 */
async function callArkResponses(env, params, options) {
  const timeoutMs =
    options && Number(options.timeoutMs) > 0 ? Number(options.timeoutMs) : ARK_TIMEOUT_MS;
  const body = {
    model: env.modelId,
    instructions: params.instructions,
    input: [{ role: "user", content: params.userContent }],
    max_output_tokens: ARK_MAX_OUTPUT_TOKENS,
    stream: false,
  };

  const headers = {
    Authorization: `Bearer ${env.apiKey}`,
  };

  let lastErr = "ARK_REQUEST_FAILED";
  let lastStatus = 0;

  for (let attempt = 0; attempt <= ARK_MAX_RETRIES; attempt++) {
    const started = Date.now();
    try {
      const res = await postJson(env.responsesUrl, headers, body, timeoutMs);
      const durationMs = Date.now() - started;
      lastStatus = res.statusCode;
      let parsed = null;
      try {
        parsed = JSON.parse(res.body || "{}");
      } catch (e) {
        lastErr = "ARK_BAD_JSON";
        if (attempt < ARK_MAX_RETRIES && isRetryableStatus(res.statusCode)) continue;
        break;
      }

      if (res.statusCode >= 200 && res.statusCode < 300) {
        const text = extractReplyText(parsed);
        if (text) {
          logEvent({
            action: "arkCall",
            errCode: "OK",
            httpStatus: res.statusCode,
            durationMs,
            quadrantId: params.meta && params.meta.quadrantId,
            cardField: params.meta && params.meta.cardField,
            textHash: params.meta && params.meta.textHash,
          });
          return { ok: true, text, httpStatus: res.statusCode };
        }
        lastErr = "ARK_EMPTY_OUTPUT";
      } else {
        lastErr =
          (parsed && parsed.error && (parsed.error.code || parsed.error.message)) ||
          `ARK_HTTP_${res.statusCode}`;
        if (attempt < ARK_MAX_RETRIES && isRetryableStatus(res.statusCode)) continue;
      }
    } catch (e) {
      lastErr = e && e.message === "ARK_TIMEOUT" ? "ARK_TIMEOUT" : "ARK_NETWORK";
      logEvent({
        level: "error",
        action: "arkCall",
        errCode: lastErr,
        httpStatus: lastStatus,
        durationMs: Date.now() - started,
        quadrantId: params.meta && params.meta.quadrantId,
        cardField: params.meta && params.meta.cardField,
        textHash: params.meta && params.meta.textHash,
      });
      if (attempt < ARK_MAX_RETRIES) continue;
    }
  }

  logEvent({
    level: "error",
    action: "arkCall",
    errCode: lastErr,
    httpStatus: lastStatus,
    quadrantId: params.meta && params.meta.quadrantId,
    cardField: params.meta && params.meta.cardField,
    textHash: params.meta && params.meta.textHash,
  });

  return { ok: false, errCode: lastErr, httpStatus: lastStatus };
}

module.exports = {
  callArkResponses,
  extractReplyText,
};
