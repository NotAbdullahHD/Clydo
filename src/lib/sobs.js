import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * sob counts — one small json file, no database.
 *
 * counts are keyed per server, which is what the old bot's global collection
 * got wrong: its leaderboard had to re-check membership to hide other servers.
 */

const file = path.join(process.cwd(), 'data', 'sobs.json');
let cache = null;

async function load() {
  if (cache) return cache;

  try {
    cache = JSON.parse(await readFile(file, 'utf8'));
  } catch {
    cache = {};
  }

  return cache;
}

async function save() {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(cache, null, 2)}\n`);
}

const key = (guildId, userId) => `${guildId}:${userId}`;

/** add one sob and return the new total. */
export async function sob(guildId, userId) {
  const counts = await load();
  const id = key(guildId, userId);

  counts[id] = (counts[id] ?? 0) + 1;
  await save();

  return counts[id];
}

/** every counted user in a server, highest first. */
export async function board(guildId) {
  const counts = await load();
  const prefix = `${guildId}:`;

  return Object.entries(counts)
    .filter(([id]) => id.startsWith(prefix))
    .map(([id, count]) => ({ userId: id.slice(prefix.length), count }))
    .sort((a, b) => b.count - a.count);
}
