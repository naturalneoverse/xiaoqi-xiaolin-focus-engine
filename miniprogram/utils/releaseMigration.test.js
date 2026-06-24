"use strict";

const STORAGE_KEYS = require("../config/storageKeys");
const {
  MIGRATION_GUEST_INTRO_EXPERIENCE_V1,
  runPendingReleaseMigrationsWithDeps,
} = require("./releaseMigration");

function assert(cond, msg) {
  if (!cond) throw new Error(msg || "assertion failed");
}

function createMockDeps(initial) {
  const store = Object.assign({}, initial || {});
  let sessionCleared = 0;
  let brandDismissReset = 0;
  const deps = {
    getStorageSync(key) {
      return store[key];
    },
    setStorageSync(key, value) {
      store[key] = value;
    },
    removeStorage(key) {
      delete store[key];
    },
    clearSessionStorage() {
      sessionCleared += 1;
      delete store.token;
      delete store.userInfo;
      delete store[STORAGE_KEYS.HAS_LOGGED_IN];
      delete store[STORAGE_KEYS.USER_OPENID];
    },
    resetBrandIntroSessionDismissed() {
      brandDismissReset += 1;
    },
    _store: store,
    _sessionCleared: () => sessionCleared,
    _brandDismissReset: () => brandDismissReset,
  };
  return deps;
}

const deps1 = createMockDeps({
  token: "t1",
  userInfo: { nickName: "a", openid: "o1" },
  [STORAGE_KEYS.HAS_LOGGED_IN]: true,
  [STORAGE_KEYS.BRAND_INTRO_SEEN]: true,
  [STORAGE_KEYS.USER_PROFILE]: { nickname: "keep" },
  [STORAGE_KEYS.TASKS_DATA]: [{ id: "task1" }],
});

const ran1 = runPendingReleaseMigrationsWithDeps(deps1);
assert(ran1.length === 1 && ran1[0] === MIGRATION_GUEST_INTRO_EXPERIENCE_V1, "first run applies migration");
assert(deps1._sessionCleared() === 1, "clears session once");
assert(deps1._store[STORAGE_KEYS.BRAND_INTRO_SEEN] === undefined, "clears brand intro seen");
assert(deps1._store[STORAGE_KEYS.USER_PROFILE].nickname === "keep", "keeps user profile");
assert(deps1._store[STORAGE_KEYS.TASKS_DATA].length === 1, "keeps tasks");
assert(deps1._brandDismissReset() === 1, "resets session dismiss flag");

const ran2 = runPendingReleaseMigrationsWithDeps(deps1);
assert(ran2.length === 0, "second run is idempotent");
assert(deps1._sessionCleared() === 1, "does not clear session again");

console.log("[releaseMigration.test] OK");
