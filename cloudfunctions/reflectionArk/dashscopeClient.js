"use strict";

const https = require("https");
const { URL } = require("url");
const { logEvent } = require("./logger");

/**
 * @param {object} body
 * @returns {string}
 */
function extractChatCompletionText(body) {
  if (!body || typeof body !== "object") return "";
  const choice = body.choices && body.choices[0];
  const msg = choice && choice.message;
  if (msg && typeof msg.content === "string" && msg.content.trim()) {
    return msg.content.trim();
  }
  if (typeof body.output_text === "string" && body.output_text.trim()) {
    return body.output_text.trim();
  }
  return "";
}

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
      reject(new Error("timeout"));
    });
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

/**
 * @param {object} env loadDashscopeEnv()
 * @param {object} opts
 * @param {string} opts.modelId
 * @param {string} opts.system
 * @param {string} opts.userContent
 * @param {number} [opts.maxTokens]
 * @param {number} [opts.timeoutMs]
 * @param {object} [opts.meta]
 */
async function callDashscopeChat(env, opts) {
  const started = Date.now();
  const timeoutMs = (opts && opts.timeoutMs) || 25000;
  const meta = (opts && opts.meta) || {};
  const requestBody = {
    model: String(opts.modelId || "").trim(),
    messages: [
      { role: "system", content: String(opts.system || "").trim() },
      { role: "user", content: String(opts.userContent || "").trim() },
    ],
    max_tokens: (opts && opts.maxTokens) || 500,
    temperature: 0.7,
    enable_thinking: false,
  };

  try {
    const res = await postJson(
      env.chatCompletionsUrl,
      { Authorization: `Bearer ${env.apiKey}` },
      requestBody,
      timeoutMs,
    );
    const durationMs = Date.now() - started;
    let parsed = null;
    try {
      parsed = JSON.parse(res.body || "{}");
    } catch (e) {
      parsed = null;
    }

    if (res.statusCode < 200 || res.statusCode >= 300) {
      const errMsg =
        (parsed && parsed.error && parsed.error.message) ||
        (parsed && parsed.message) ||
        `HTTP_${res.statusCode}`;
      logEvent({
        action: "dashscopeCall",
        phase: meta.phase || "",
        errCode: "DASHSCOPE_HTTP",
        quadrantId: meta.quadrantId || "",
        cardField: meta.cardField || "",
        httpStatus: res.statusCode,
        durationMs,
      });
      return { ok: false, errCode: "DASHSCOPE_HTTP", httpStatus: res.statusCode, durationMs };
    }

    if (parsed && parsed.error) {
      const code = parsed.error.code || parsed.error.type || "DASHSCOPE_ERROR";
      logEvent({
        action: "dashscopeCall",
        phase: meta.phase || "",
        errCode: code,
        quadrantId: meta.quadrantId || "",
        cardField: meta.cardField || "",
        durationMs,
      });
      return { ok: false, errCode: String(code), durationMs };
    }

    const text = extractChatCompletionText(parsed);
    if (!text) {
      logEvent({
        action: "dashscopeCall",
        phase: meta.phase || "",
        errCode: "DASHSCOPE_EMPTY",
        quadrantId: meta.quadrantId || "",
        cardField: meta.cardField || "",
        durationMs,
      });
      return { ok: false, errCode: "DASHSCOPE_EMPTY", durationMs };
    }

    logEvent({
      action: "dashscopeCall",
      phase: meta.phase || "",
      errCode: "OK",
      quadrantId: meta.quadrantId || "",
      cardField: meta.cardField || "",
      durationMs,
    });
    return { ok: true, text, durationMs };
  } catch (e) {
    const durationMs = Date.now() - started;
    const isTimeout = e && String(e.message || e).indexOf("timeout") >= 0;
    logEvent({
      action: "dashscopeCall",
      phase: meta.phase || "",
      errCode: isTimeout ? "DASHSCOPE_TIMEOUT" : "DASHSCOPE_NETWORK",
      quadrantId: meta.quadrantId || "",
      cardField: meta.cardField || "",
      durationMs,
    });
    return { ok: false, errCode: isTimeout ? "DASHSCOPE_TIMEOUT" : "DASHSCOPE_NETWORK", durationMs };
  }
}

module.exports = {
  callDashscopeChat,
  extractChatCompletionText,
};
