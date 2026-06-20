/**
 * 登录后开屏视频（云存储）
 * 测试期：每次登录成功均播放；后期可在此加次数限制。
 */

const LOGIN_SPLASH_FILE_ID =
  "cloud://cloud1-9goe0m7d1d397415.636c-cloud1-9goe0m7d1d397415-1397682513/splash/splash-login.mp4";

/** 起播后须看满的成片时长（毫秒） */
const LOGIN_SPLASH_DURATION_MS = 15000;

/** 起播前加载等待上限（毫秒），超时静默跳过开屏 */
const LOGIN_SPLASH_LOAD_TIMEOUT_MS = 6000;

module.exports = {
  LOGIN_SPLASH_FILE_ID,
  LOGIN_SPLASH_DURATION_MS,
  LOGIN_SPLASH_LOAD_TIMEOUT_MS,
};
