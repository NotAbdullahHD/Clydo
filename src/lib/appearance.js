import { sql } from './sqlite.js';

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

/** discord rejects anything huge, and nobody needs a 20MB avatar. */
const maxBytes = 5 * 1024 * 1024;

const shape = (doc) => ({
  guildId: doc.guildId,
  avatar: doc.avatar ?? null,
  banner: doc.banner ?? null,
  bio: doc.bio ?? null,
});

/** what this server asked for, not what discord currently holds. */
export async function get(guildId) {
  const row = sql().prepare('SELECT avatar, banner, bio FROM appearance WHERE guild_id = ?').get(guildId);

  return shape({ guildId, ...row });
}

/** remember the request so the panel and reset know what was set. */
export async function set(guildId, patch) {
  const next = shape({ ...(await get(guildId)), ...patch });

  sql()
    .prepare(`
      INSERT INTO appearance (guild_id, avatar, banner, bio) VALUES (?, ?, ?, ?)
      ON CONFLICT (guild_id) DO UPDATE SET
        avatar = excluded.avatar, banner = excluded.banner, bio = excluded.bio
    `)
    .run(next.guildId, next.avatar, next.banner, next.bio);

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
