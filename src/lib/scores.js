import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { db } from './db.js';

/**
 * one score table per feature, scoped per server.
 *
 * mongo when MONGO_URI is set, otherwise a json file under data/. both backends
 * answer the same three questions: add a point, read a page, count the players.
 */

export function scoreStore({ collection, file }) {
  const target = path.join(process.cwd(), 'data', file);
  const key = (guildId, userId) => `${guildId}:${userId}`;

  let cache = null;

  async function load() {
    if (cache) return cache;

    let raw = {};

    try {
      raw = JSON.parse(await readFile(target, 'utf8'));
    } catch {
      raw = {};
    }

    cache = { scores: raw?.scores ?? {} };
    return cache;
  }

  async function save() {
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, `${JSON.stringify(cache, null, 2)}\n`);
  }

  const table = () => db()?.collection(collection);

  return {
    /** one win. returns the player's new score. */
    async add(guildId, userId, username) {
      const rows = table();

      if (rows) {
        const doc = await rows.findOneAndUpdate(
          { guildId, userId },
          { $inc: { score: 1 }, $set: { username } },
          { upsert: true, returnDocument: 'after' },
        );

        return doc?.score ?? 0;
      }

      const data = await load();
      const slot = key(guildId, userId);
      const entry = data.scores[slot] ?? { score: 0, username };

      entry.score += 1;
      entry.username = username;
      data.scores[slot] = entry;

      await save();
      return entry.score;
    },

    /** one page of the table, best first. */
    async board(guildId, limit = 10, skip = 0) {
      const rows = table();

      if (rows) {
        const docs = await rows
          .find({ guildId }, { projection: { userId: 1, username: 1, score: 1 } })
          .sort({ score: -1 })
          .skip(skip)
          .limit(limit)
          .toArray();

        return docs.map((doc) => ({ userId: doc.userId, username: doc.username, score: doc.score }));
      }

      const data = await load();
      const prefix = `${guildId}:`;

      return Object.entries(data.scores)
        .filter(([id]) => id.startsWith(prefix))
        .map(([id, entry]) => ({
          userId: id.slice(prefix.length),
          username: entry.username,
          score: entry.score,
        }))
        .sort((a, b) => b.score - a.score)
        .slice(skip, skip + limit);
    },

    /** how many players have a score — used for page counts. */
    async total(guildId) {
      const rows = table();
      if (rows) return rows.countDocuments({ guildId });

      const data = await load();
      const prefix = `${guildId}:`;

      return Object.keys(data.scores).filter((id) => id.startsWith(prefix)).length;
    },
  };
}
