/**
 * 三幕背景：资源与路径必须在分包内声明（真机才能稳定加载）
 * 优先相对路径，失败时 index.js 会再试绝对路径
 */
const ACT_FILES = {
  1: "bg-act1.jpg",
  2: "bg-act2.jpg",
  3: "bg-act3.jpg",
};

function pathsForAct(act) {
  const file = ACT_FILES[act] || ACT_FILES[1];
  return [`./${file}`, `/subpkg/brand-intro/${file}`];
}

function bgPathForAct(act) {
  return pathsForAct(act)[0];
}

module.exports = {
  ACT_FILES,
  pathsForAct,
  bgPathForAct,
};
