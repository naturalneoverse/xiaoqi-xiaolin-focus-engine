"use strict";

const { CACHE_COLLECTION } = require("./constants");

/**
 * @param {object} db cloud.database()
 * @param {{ taskId: string, quadrantId: number, cardField: string, textHash: string }} key
 */
async function findCache(db, key) {
  const res = await db
    .collection(CACHE_COLLECTION)
    .where({
      taskId: key.taskId,
      quadrantId: key.quadrantId,
      cardField: key.cardField,
      textHash: key.textHash,
    })
    .limit(1)
    .get();
  const doc = res.data && res.data[0];
  return doc && typeof doc.replyContent === "string" ? doc : null;
}

/**
 * @param {object} db
 * @param {object} row
 */
async function upsertCache(db, row) {
  const existing = await findCache(db, row);
  const data = {
    taskId: row.taskId,
    quadrantId: row.quadrantId,
    cardField: row.cardField,
    textHash: row.textHash,
    agentType: row.agentType,
    replyContent: row.replyContent,
    createdAt: row.createdAt || new Date(),
  };
  if (existing && existing._id) {
    await db.collection(CACHE_COLLECTION).doc(existing._id).update({ data });
    return existing._id;
  }
  const addRes = await db.collection(CACHE_COLLECTION).add({ data });
  return addRes._id;
}

module.exports = { findCache, upsertCache, CACHE_COLLECTION };
