/**
 * 身体边界周报 · 百炼成文云函数客户端
 */

const { callFunction, isCloudReady } = require("./cloudCall");
const { CLOUD_FUNCTION_NAME, ERR_CLOUD_NOT_READY } = require("../config/reflectionArkConfig");

const GENERATE_BODY_WEEK_CARE_TIMEOUT_MS = 65000;

function unwrapResult(res) {
  return res && res.result != null ? res.result : null;
}

/**
 * @param {{ bullets: object[], weekKey: string, dayCount: number, finalStatusTitle: string }} params
 */
function generateBodyWeekCare(params) {
  const bullets = params && params.bullets;
  const weekKey = String((params && params.weekKey) || "").trim();
  const dayCount = Number(params && params.dayCount);
  const finalStatusTitle = String((params && params.finalStatusTitle) || "").trim();

  if (!Array.isArray(bullets) || !bullets.length || !weekKey || !finalStatusTitle) {
    return Promise.resolve({ ok: false, errCode: "INVALID_PARAMS" });
  }
  if (!Number.isFinite(dayCount) || dayCount < 2) {
    return Promise.resolve({ ok: false, errCode: "SPARSE_WEEK" });
  }
  if (!isCloudReady()) {
    return Promise.resolve({ ok: false, errCode: ERR_CLOUD_NOT_READY });
  }

  return callFunction(
    {
      name: CLOUD_FUNCTION_NAME,
      data: {
        action: "generateBodyWeekCare",
        bullets,
        weekKey,
        dayCount,
        finalStatusTitle,
      },
    },
    GENERATE_BODY_WEEK_CARE_TIMEOUT_MS,
  )
    .then((res) => {
      const result = unwrapResult(res);
      if (result && result.ok) {
        return {
          ok: true,
          statusDesc: String(result.statusDesc || ""),
          careText: String(result.careText || ""),
          deployTag: result.deployTag || "",
        };
      }
      return {
        ok: false,
        errCode: (result && result.errCode) || "BODY_WEEK_CARE_FAILED",
      };
    })
    .catch((e) => {
      console.error("[bodyWeekCareClient] generateBodyWeekCare", e);
      return { ok: false, errCode: "BODY_WEEK_CARE_NETWORK" };
    });
}

module.exports = {
  generateBodyWeekCare,
  GENERATE_BODY_WEEK_CARE_TIMEOUT_MS,
};
