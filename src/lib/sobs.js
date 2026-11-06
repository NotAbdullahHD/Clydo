import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { db } from './db.js';

/**
 * sob counts and per-server settings.
 *
 * mongo when MONGO_URI is set, otherwise a small json file, so the bot runs
 * either way. both backends are keyed per server — the old bot's global
 * collection needed membership lookups just to hide other servers' counts.
 */

const file = path.join(process.cwd(), 'data', 'sobs.json');
let cache = null;

/* ── json fallback ───────────────────────────────────────── */

async function loadJson() {
  if (cache) return cache;

  let raw = {};

  try {
    raw = JSON.parse(await readFile(file, 'utf8'));
  } catch {
    raw = {};
  }

  // older files were a flat "guildId:userId": count map.
  cache = raw && (raw.counts || raw.guilds)
    ? { counts: raw.counts ?? {}, guilds: raw.guilds ?? {} }
    : { counts: raw ?? {}, guilds: {} };

  return cache;
}

async function saveJson() {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(cache, null, 2)}\n`);
}

const key = (guildId, userId) => `${guildId}:${userId}`;

/* ── mongo ───────────────────────────────────────────────── */

const counts = () => db()?.collection('counts');
const guilds = () => db()?.collection('guilds');

/* ── api ─────────────────────────────────────────────────── */

export async function count(guildId, userId) {
  const collection = counts();

  if (collection) {
    const doc = await collection.findOne({ guildId, userId });
    return doc?.count ?? 0;
  }

  const data = await loadJson();
  return data.counts[key(guildId, userId)] ?? 0;
}

/** add (or remove, with a negative amount) sobs and return the new total. */
export async function addSobs(guildId, userId, amount) {
  const collection = counts();

  if (collection) {
    const doc = await collection.findOneAndUpdate(
      { guildId, userId },
      { $inc: { count: amount } },
      { upsert: true, returnDocument: 'after' },
    );

    const value = doc?.count ?? 0;

    if (value < 0) {
      await collection.updateOne({ guildId, userId }, { $set: { count: 0 } });
      return 0;
    }

    return value;
  }

  const data = await loadJson();
  const id = key(guildId, userId);

  data.counts[id] = Math.max(0, (data.counts[id] ?? 0) + amount);
  await saveJson();

  return data.counts[id];
}

/** every counted member in a server, highest first. */
export async function board(guildId) {
  const collection = counts();

  if (collection) {
    const docs = await collection
      .find({ guildId }, { projection: { userId: 1, count: 1 } })
      .sort({ count: -1 })
      .limit(100)
      .toArray();

    return docs.map((doc) => ({ userId: doc.userId, count: doc.count }));
  }

  const data = await loadJson();
  const prefix = `${guildId}:`;

  return Object.entries(data.counts)
    .filter(([id]) => id.startsWith(prefix))
    .map(([id, value]) => ({ userId: id.slice(prefix.length), count: value }))
    .sort((a, b) => b.count - a.count);
}

/** enabled flag and ban list. enabled defaults to true. */
export async function settings(guildId) {
  const collection = guilds();

  if (collection) {
    const doc = await collection.findOne({ guildId });
    return { enabled: doc?.enabled !== false, banned: doc?.banned ?? [] };
  }

  const data = await loadJson();
  const guild = data.guilds[guildId] ?? {};

  return { enabled: guild.enabled !== false, banned: guild.banned ?? [] };
}

export async function setEnabled(guildId, enabled) {
  const collection = guilds();

  if (collection) {
    await collection.updateOne({ guildId }, { $set: { enabled } }, { upsert: true });
    return enabled;
  }

  const data = await loadJson();
  const guild = data.guilds[guildId] ?? {};

  data.guilds[guildId] = { ...guild, enabled };
  await saveJson();

  return enabled;
}

export async function setBanned(guildId, userId, banned) {
  const collection = guilds();

  if (collection) {
    await collection.updateOne(
      { guildId },
      banned ? { $addToSet: { banned: userId } } : { $pull: { banned: userId } },
      { upsert: true },
    );
    return banned;
  }

  const data = await loadJson();
  const guild = data.guilds[guildId] ?? {};
  const list = new Set(guild.banned ?? []);

  if (banned) list.add(userId);
  else list.delete(userId);

  data.guilds[guildId] = { ...guild, banned: [...list] };
  await saveJson();

  return banned;
}

/**
 * one-time lift of the json file into mongo, then park the file so it can't be
 * re-imported over a database that has since changed.
 */
export async function migrateFromJson() {
  const collection = counts();
  if (!collection) return 0;

  if ((await collection.estimatedDocumentCount()) > 0) return 0;

  const data = await loadJson();

  const docs = Object.entries(data.counts)
    .map(([id, value]) => {
      const [guildId, userId] = id.split(':');
      return guildId && userId ? { guildId, userId, count: value } : null;
    })
    .filter(Boolean);

  if (docs.length === 0) return 0;

  await collection.insertMany(docs);
  await rename(file, `${file}.migrated`).catch(() => {});

  return docs.length;
}
