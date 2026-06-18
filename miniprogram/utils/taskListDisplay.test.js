const assert = require("assert");
const {
  sortIncompleteTasks,
  sortCompletedTasksNewestFirst,
  summarizeWhyLabels,
  buildPendingDisplay,
  buildPastDateDisplay,
  buildDoneTodayDisplay,
  getPriorityRank,
  getPastTaskAllTags,
} = require("./taskListDisplay");

function run() {
  const ms = (t) => Number(t.updatedAt) || 0;

  const incomplete = sortIncompleteTasks(
    [
      { id: "a", tags: [{ text: "不重要不紧急" }], updatedAt: 100 },
      { id: "b", tags: [{ text: "重要且紧急" }], updatedAt: 1 },
      { id: "c", tags: [{ text: "重要不紧急" }], updatedAt: 50 },
      { id: "d", tags: [{ text: "重要且紧急" }], updatedAt: 80 },
    ],
    ms
  );
  assert.strictEqual(incomplete.map((t) => t.id).join(","), "a,d,c,b");

  assert.strictEqual(getPriorityRank({ tags: [] }), 99);
  assert.strictEqual(
    getPriorityRank({ tags: [{ text: "不二" }, { text: "重要且紧急" }] }),
    1,
  );

  const completed = sortCompletedTasksNewestFirst(
    [
      { id: "x", completedAt: "2026-05-01", updatedAt: 1 },
      { id: "y", completedAt: "2026-05-10", updatedAt: 2 },
    ],
    ms
  );
  assert.strictEqual(completed[0].id, "y");

  const summary = summarizeWhyLabels([
    { tags: [{ text: "重要且紧急" }, { text: "自己" }, { text: "真我" }] },
    { tags: [{ text: "重要不紧急" }, { text: "外缘" }, { text: "真我" }] },
    { tags: [{ text: "紧急不重要" }, { text: "不二" }, { text: "合一" }] },
  ]);
  assert.deepStrictEqual(summary, ["真我2", "合一1"]);

  const pendingFold = buildPendingDisplay([1, 2, 3, 4, 5].map((n) => ({ id: n })), false);
  assert.strictEqual(pendingFold.visible.length, 3);
  assert.strictEqual(pendingFold.hiddenCount, 2);
  assert.strictEqual(pendingFold.showExpand, true);

  const doneFold = buildDoneTodayDisplay([{ id: 1 }, { id: 2 }], false);
  assert.strictEqual(doneFold.visible.length, 1);
  assert.strictEqual(doneFold.showExpand, true);

  const pastFold = buildPastDateDisplay([1, 2, 3, 4, 5, 6, 7].map((n) => ({ dateKey: String(n) })), false);
  assert.strictEqual(pastFold.visible.length, 5);
  assert.strictEqual(pastFold.hiddenCount, 2);
  assert.strictEqual(pastFold.showExpand, true);

  const allTags = getPastTaskAllTags({
    tags: [
      { text: "重要且紧急" },
      { text: "自己" },
      { text: "真我" },
    ],
  });
  assert.strictEqual(allTags.length, 3);
  assert.strictEqual(allTags[0].text, "重要且紧急");

  console.log("taskListDisplay.test.js OK");
}

run();
