import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * sob counts and per-server settings — one small json file, no database.
 *
 * counts are keyed per server, which is what the old bot's global collection
 * got wrong: its leaderboard had to re-check membership to hide other servers.
 */

const file = path.join(process.cwd(), 'data', 'sobs.json');
let cache = null;

async function load() {
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

async function save() {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(cache, null, 2)}\n`);
}

const key = (guildId, userId) => `${guildId}:${userId}`;

/** current count for a member. */
export async function count(guildId, userId) {
  const data = await load();
  return data.counts[key(guildId, userId)] ?? 0;
}

/** add (or remove, with a negative amount) sobs and return the new total. */
export async function addSobs(guildId, userId, amount) {
  const data = await load();
  const id = key(guildId, userId);

  data.counts[id] = Math.max(0, (data.counts[id] ?? 0) + amount);
  await save();

  return data.counts[id];
}

/** every counted member in a server, highest first. */
export async function board(guildId) {
  const data = await load();
  const prefix = `${guildId}:`;

  return Object.entries(data.counts)
    .filter(([id]) => id.startsWith(prefix))
    .map(([id, count]) => ({ userId: id.slice(prefix.length), count }))
    .sort((a, b) => b.count - a.count);
}

/** enabled flag and ban list. enabled defaults to true. */
export async function settings(guildId) {
  const data = await load();
  const guild = data.guilds[guildId] ?? {};

  return { enabled: guild.enabled !== false, banned: guild.banned ?? [] };
}

export async function setEnabled(guildId, enabled) {
  const data = await load();
  const guild = data.guilds[guildId] ?? {};

  data.guilds[guildId] = { ...guild, enabled };
  await save();

  return enabled;
}

export async function setBanned(guildId, userId, banned) {
  const data = await load();
  const guild = data.guilds[guildId] ?? {};
  const list = new Set(guild.banned ?? []);

  if (banned) list.add(userId);
  else list.delete(userId);

  data.guilds[guildId] = { ...guild, banned: [...list] };
  await save();

  return banned;
}
