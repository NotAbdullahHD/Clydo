import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { db } from './db.js';

/**
 * per-server appearance — avatar, banner and bio, set by that server's owner.
 *
 * discord does not let a bot swap its own face per guild, so these are the look
 * the bot wears inside its own embeds: the help panel and the customize card.
 * mongo when MONGO_URI is set, otherwise data/appearance.json.
 */

const file = path.join(process.cwd(), 'data', 'appearance.json');

let cache = null;

const shape = (doc) => ({
  guildId: doc.guildId,
  avatar: doc.avatar ?? null,
  banner: doc.banner ?? null,
  bio: doc.bio ?? null,
});

async function load() {
  if (cache) return cache;

  let raw = {};

  try {
    raw = JSON.parse(await readFile(file, 'utf8'));
  } catch {
    raw = {};
  }

  cache = { servers: raw?.servers ?? {} };
  return cache;
}

async function save() {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(cache, null, 2)}\n`);
}

const rows = () => db()?.collection('appearance');

/** how this server looks, empty when nobody has touched it. */
export async function get(guildId) {
  const table = rows();

  if (table) return shape((await table.findOne({ guildId })) ?? { guildId });

  const data = await load();
  return shape(data.servers[guildId] ?? { guildId });
}

/** change one or more fields; null clears a field. */
export async function set(guildId, patch) {
  const next = shape({ ...(await get(guildId)), ...patch });
  const table = rows();

  if (table) {
    await table.updateOne({ guildId }, { $set: next }, { upsert: true });
    return next;
  }

  const data = await load();
  data.servers[guildId] = next;

  await save();
  return next;
}

/** back to the stock look. */
export const reset = (guildId) => set(guildId, { avatar: null, banner: null, bio: null });
