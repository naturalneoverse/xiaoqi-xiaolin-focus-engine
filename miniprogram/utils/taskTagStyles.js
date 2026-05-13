/** 列表页：未知文案返回空串，便于 mapTagClassByText 链式回退 */
function getPriorityTagClass(text) {
  if (text === "重要且紧急") return "tag-red";
  if (text === "重要不紧急") return "tag-orange";
  if (text === "紧急不重要") return "tag-blue";
  if (text === "不重要不紧急") return "tag-gray";
  return "";
}

function getForWhomTagClass(text) {
  if (text === "自己") return "tag-berry";
  if (text === "至亲") return "tag-lavender";
  if (text === "外缘") return "tag-sky";
  if (text === "不二") return "tag-violet";
  return "";
}

function getWhyTagClass(text) {
  if (text === "生计") return "tag-amber";
  if (text === "职责") return "tag-teal";
  if (text === "真我") return "tag-gold";
  if (text === "合一") return "tag-deep";
  return "";
}

function mapTagClassByText(text, fallbackClassName) {
  const mappedClassName =
    getPriorityTagClass(text) || getForWhomTagClass(text) || getWhyTagClass(text);
  return mappedClassName || fallbackClassName || "tag";
}

module.exports = {
  getPriorityTagClass,
  getForWhomTagClass,
  getWhyTagClass,
  mapTagClassByText,
};
