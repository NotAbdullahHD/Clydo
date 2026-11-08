import { Events } from 'discord.js';
import { prefix as prefixChar } from './prefix.js';
import { sql } from './sqlite.js';

/**
 * afk — one record per user, shared across every server, the same shape
 * labubu's User.afk had.
 */

const shape = (doc) => ({
  isAfk: Boolean(doc?.isAfk),
  reason: doc?.reason ?? null,
  at: doc?.at ?? null,
});

/** mark a user afk. returns when it started. */
export async function set(userId, reason) {
  const at = Date.now();

  sql()
    .prepare(`
      INSERT INTO afk (user_id, is_afk, reason, at) VALUES (?, 1, ?, ?)
      ON CONFLICT (user_id) DO UPDATE SET is_afk = 1, reason = excluded.reason, at = excluded.at
    `)
    .run(userId, reason, at);

  return at;
}

/** a user's record, empty when they have never gone afk. */
export async function get(userId) {
  const row = sql().prepare('SELECT is_afk, reason, at FROM afk WHERE user_id = ?').get(userId);

  return shape(row ? { isAfk: row.is_afk, reason: row.reason, at: row.at } : null);
}

/** clear it — on their next message, or on request. */
export async function clear(userId) {
  sql()
    .prepare('UPDATE afk SET is_afk = 0, reason = NULL, at = NULL WHERE user_id = ?')
    .run(userId);
}

/** discord relative time, so "went afk 2 hours ago" stays accurate. */
const stamp = (at) => (at ? `<t:${Math.floor(at / 1000)}:R>` : 'recently');

/** notices clean themselves up; nobody wants an afk receipt in the chat. */
const vanish = (message, ms) => setTimeout(() => message.delete().catch(() => {}), ms).unref?.();

/**
 * two jobs on every message: welcome an afk member back, and tell anyone who
 * pings an afk member that they are away. commands are skipped, otherwise
 * ,afk would set the status and clear it in the same breath.
 */
export function watch(client, log = () => {}) {
  client.on(Events.MessageCreate, async (message) => {
    if (!message.guild || message.author.bot) return;
    if ((message.content ?? '').startsWith(prefixChar)) return;

    try {
      const mine = await get(message.author.id);

      if (mine.isAfk) {
        await clear(message.author.id);

        const back = await message
          .reply(`welcome back, **${message.author.username}** — you went afk ${stamp(mine.at)} *(${mine.reason ?? 'afk'})*`)
          .catch(() => null);

        if (back) vanish(back, 6000);
      }

      for (const [, user] of message.mentions.users) {
        if (user.bot || user.id === message.author.id) continue;

        const theirs = await get(user.id);
        if (!theirs.isAfk) continue;

        const note = await message
          .reply(`**${user.username}** is afk ${stamp(theirs.at)} — *${theirs.reason ?? 'afk'}*`)
          .catch(() => null);

        if (note) vanish(note, 7000);
      }
    } catch (error) {
      log('afk notice skipped —', error?.message ?? error);
    }
  });
}
