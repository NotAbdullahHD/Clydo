import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { db } from './db.js';

/**
 * sob counts, per-server settings, and the award ledger.
 *
 * mongo when MONGO_URI is set, otherwise a small json file, so the bot runs
 * either way. both backends are keyed per server — the old bot's global
 * collection needed membership lookups just to hide other servers' counts.
 *
 * every credit is recorded in `awards` as guild + message + reactor. that is the
 * anti-farm guard: removing and re-adding one reaction cannot pay twice, and a
 * second bot session that also saw the event cannot credit it again.
 */

const file = path.join(process.cwd(), 'data', 'sobs.json');

/** awards older than this are pruned — long enough that no old reaction pays twice. */
const awardTtl = 30 * 24 * 60 * 60 * 1000;

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

  // older files were a flat "guildId:userId": count map, and had no ledger.
  cache = raw && (raw.counts || raw.guilds || raw.awards)
    ? { counts: raw.counts ?? {}, guilds: raw.guilds ?? {}, awards: raw.awards ?? {} }
    : { counts: raw ?? {}, guilds: {}, awards: {} };

  return cache;
}

async function saveJson() {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(cache, null, 2)}\n`);
}

const key = (guildId, userId) => `${guildId}:${userId}`;
const awardKey = (guildId, messageId, reactorId) => `${guildId}:${messageId}:${reactorId}`;

/** drop ledger entries past the ttl so the file cannot grow forever. */
function prune(data) {
  const horizon = Date.now() - awardTtl;

  for (const [id, meta] of Object.entries(data.awards)) {
    if ((meta?.at ?? 0) < horizon) delete data.awards[id];
  }
}

/* ── mongo ───────────────────────────────────────────────── */

const counts = () => db()?.collection('counts');
const guilds = () => db()?.collection('guilds');
const awards = () => db()?.collection('awards');

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

/**
 * credit one sob for a reaction. returns the author's new total, or null when
 * this reactor already paid for this message.
 */
export async function award(guildId, messageId, reactorId, authorId) {
  const collection = awards();

  if (collection) {
    try {
      await collection.insertOne({ guildId, messageId, reactorId, authorId, at: new Date() });
    } catch (error) {
      // duplicate key — this reactor was already counted on this message.
      if (error?.code === 11000) return null;
      throw error;
    }

    return addSobs(guildId, authorId, 1);
  }

  const data = await loadJson();
  const id = awardKey(guildId, messageId, reactorId);

  if (data.awards[id]) return null;

  prune(data);
  data.awards[id] = { authorId, at: Date.now() };

  const slot = key(guildId, authorId);
  data.counts[slot] = Math.max(0, (data.counts[slot] ?? 0) + 1);
  await saveJson();

  return data.counts[slot];
}

/**
 * take a sob back when the reaction is removed. returns the author's new total,
 * or null when that reactor had never been counted.
 */
export async function revoke(guildId, messageId, reactorId) {
  const collection = awards();

  if (collection) {
    const doc = await collection.findOneAndDelete({ guildId, messageId, reactorId });
    if (!doc) return null;

    return addSobs(guildId, doc.authorId, -1);
  }

  const data = await loadJson();
  const id = awardKey(guildId, messageId, reactorId);
  const credited = data.awards[id];

  if (!credited) return null;

  delete data.awards[id];

  const slot = key(guildId, credited.authorId);
  data.counts[slot] = Math.max(0, (data.counts[slot] ?? 0) - 1);
  await saveJson();

  return data.counts[slot];
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
