import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { db } from './db.js';

/**
 * flag game scores, scoped per server: mongo when MONGO_URI is set, otherwise
 * data/flags.json. nothing here is global — one server's scores never leak into
 * another's leaderboard.
 */

const file = path.join(process.cwd(), 'data', 'flags.json');
let cache = null;

const key = (guildId, userId) => `${guildId}:${userId}`;

async function loadJson() {
  if (cache) return cache;

  let raw = {};

  try {
    raw = JSON.parse(await readFile(file, 'utf8'));
  } catch {
    raw = {};
  }

  cache = { scores: raw?.scores ?? {} };
  return cache;
}

async function saveJson() {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(cache, null, 2)}\n`);
}

/** one won round. returns the player's new score. */
export async function addPoint(guildId, userId, username) {
  const collection = db()?.collection('flags');

  if (collection) {
    const doc = await collection.findOneAndUpdate(
      { guildId, userId },
      { $inc: { score: 1 }, $set: { username } },
      { upsert: true, returnDocument: 'after' },
    );

    return doc?.score ?? 0;
  }

  const data = await loadJson();
  const slot = key(guildId, userId);
  const entry = data.scores[slot] ?? { score: 0, username };

  entry.score += 1;
  entry.username = username;
  data.scores[slot] = entry;

  await saveJson();
  return entry.score;
}

/** highest scores in a server, best first. */
export async function board(guildId, limit = 10, skip = 0) {
  const collection = db()?.collection('flags');

  if (collection) {
    const docs = await collection
      .find({ guildId }, { projection: { userId: 1, username: 1, score: 1 } })
      .sort({ score: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    return docs.map((doc) => ({ userId: doc.userId, username: doc.username, score: doc.score }));
  }

  const data = await loadJson();
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
}

/** how many people have a score in this server — used for page counts. */
export async function total(guildId) {
  const collection = db()?.collection('flags');

  if (collection) return collection.countDocuments({ guildId });

  const data = await loadJson();
  const prefix = `${guildId}:`;

  return Object.keys(data.scores).filter((id) => id.startsWith(prefix)).length;
}
