import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { db } from './db.js';

/**
 * appearance.
 *
 * discord has no per-server bot face: an avatar or banner is one image for the
 * whole application, so those two go straight to the client. the bio is the one
 * thing a server really can own, so it is stored per guild. the first time
 * anyone customizes, the shipped avatar and banner are remembered, which is what
 * reset puts back.
 */

const file = path.join(process.cwd(), 'data', 'appearance.json');

/** a guildId nobody can have, used for the remembered originals. */
const original = 'defaults';

let cache = null;

const bioShape = (doc) => ({ guildId: doc.guildId, bio: doc.bio ?? null });

const imageShape = (doc) => ({ avatar: doc?.avatar ?? null, banner: doc?.banner ?? null });

async function load() {
  if (cache) return cache;

  let raw = {};

  try {
    raw = JSON.parse(await readFile(file, 'utf8'));
  } catch {
    raw = {};
  }

  cache = { servers: raw?.servers ?? {}, defaults: raw?.defaults ?? {} };
  return cache;
}

async function save() {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(cache, null, 2)}\n`);
}

const rows = () => db()?.collection('appearance');

/** this server's bio. */
export async function bio(guildId) {
  const table = rows();

  if (table) return bioShape((await table.findOne({ guildId })) ?? { guildId });

  const data = await load();
  return bioShape(data.servers[guildId] ?? { guildId });
}

/** set or clear this server's bio. */
export async function setBio(guildId, value) {
  const next = bioShape({ guildId, bio: value || null });
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

/** keep the first avatar and banner we ever saw, so reset has something to show. */
export async function remember(avatar, banner) {
  const table = rows();

  if (table) {
    const existing = await table.findOne({ guildId: original });
    if (existing) return imageShape(existing);

    await table.updateOne({ guildId: original }, { $set: { guildId: original, avatar, banner } }, { upsert: true });
    return imageShape({ avatar, banner });
  }

  const data = await load();
  if (data.defaults.avatar || data.defaults.banner) return imageShape(data.defaults);

  data.defaults = { avatar, banner };

  await save();
  return imageShape(data.defaults);
}

/** what the bot looked like before anyone touched it. */
export async function defaults() {
  const table = rows();

  if (table) return imageShape(await table.findOne({ guildId: original }));

  const data = await load();
  return imageShape(data.defaults);
}
