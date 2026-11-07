import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { db } from './db.js';

/**
 * per-server bot profile.
 *
 * modify current member takes avatar, banner and bio per guild, so one server can
 * give the bot its own face without touching any other. images go up as base64
 * data uris, which means downloading whatever link the owner pasted first.
 *
 * discord.js 14 does not expose these three on GuildMemberEditOptions, so the
 * route is called directly — same endpoint, same payload, nothing dropped.
 */

const file = path.join(process.cwd(), 'data', 'appearance.json');

/** discord rejects anything huge, and nobody needs a 20MB avatar. */
const maxBytes = 5 * 1024 * 1024;

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

/** what this server asked for, not what discord currently holds. */
export async function get(guildId) {
  const table = rows();

  if (table) return shape((await table.findOne({ guildId })) ?? { guildId });

  const data = await load();
  return shape(data.servers[guildId] ?? { guildId });
}

/** remember the request so the panel and reset know what was set. */
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

/** base64 data uri for anything discord will accept as an image. */
export async function image(source) {
  if (/^data:image\//i.test(source)) return source;

  const response = await fetch(source);
  if (!response.ok) throw new Error(`could not download that image (${response.status})`);

  const type = (response.headers.get('content-type') ?? 'image/png').split(';')[0].trim();
  if (!type.startsWith('image/')) throw new Error('that link is not an image');

  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.byteLength > maxBytes) throw new Error('that image is too large');

  return `data:${type};base64,${bytes.toString('base64')}`;
}

/**
 * apply a look to one guild. null clears a field, undefined leaves it alone.
 * returns the stored record; throws with a readable reason when discord refuses.
 */
export async function apply(client, guildId, patch) {
  const body = {};

  if ('avatar' in patch) body.avatar = patch.avatar ? await image(patch.avatar) : null;
  if ('banner' in patch) body.banner = patch.banner ? await image(patch.banner) : null;
  if ('bio' in patch) body.bio = patch.bio || null;

  await client.rest.patch(`/guilds/${guildId}/members/@me`, { body });

  return set(guildId, patch);
}

/** back to the plain application look, in this guild only. */
export const reset = (client, guildId) => apply(client, guildId, { avatar: null, banner: null, bio: null });
