import { Events } from 'discord.js';
import { prefix as prefixChar } from './prefix.js';
import { sql } from './sqlite.js';

/**
 * afk — one record per user, shared across every server.
 *
 * while somebody is away, every mention of them is counted, so coming back is a
 * sentence about who wanted them and how many times, not just "welcome back".
 */

const shape = (doc) => ({
  isAfk: Boolean(doc?.isAfk),
  reason: doc?.reason ?? null,
  at: doc?.at ?? null,
});

export async function set(userId, reason) {
  const at = Date.now();

  sql()
    .prepare(`
      INSERT INTO afk (user_id, is_afk, reason, at) VALUES (?, 1, ?, ?)
      ON CONFLICT (user_id) DO UPDATE SET is_afk = 1, reason = excluded.reason, at = excluded.at
    `)
    .run(userId, reason, at);

  sql().prepare('DELETE FROM afk_pings WHERE user_id = ?').run(userId);

  return at;
}

export async function get(userId) {
  const row = sql().prepare('SELECT is_afk, reason, at FROM afk WHERE user_id = ?').get(userId);

  return shape(row ? { isAfk: row.is_afk, reason: row.reason, at: row.at } : null);
}

export async function clear(userId) {
  sql().prepare('UPDATE afk SET is_afk = 0, reason = NULL, at = NULL WHERE user_id = ?').run(userId);
}

/** one row per mention, capped at twenty per person and cleaned after a day. */
export function ping(userId, fromId, channelId = null) {
  const at = Date.now();

  sql()
    .prepare('INSERT OR IGNORE INTO afk_pings (user_id, from_id, channel_id, at) VALUES (?, ?, ?, ?)')
    .run(userId, fromId, channelId, at);

  sql().prepare('DELETE FROM afk_pings WHERE user_id = ? AND at < ?').run(userId, at - 86_400_000);
  sql()
    .prepare(`
      DELETE FROM afk_pings
      WHERE user_id = ? AND at NOT IN (
        SELECT at FROM afk_pings WHERE user_id = ? ORDER BY at DESC LIMIT 20
      )
    `)
    .run(userId, userId);
}

export const pings = (userId) => sql()
  .prepare('SELECT from_id, at FROM afk_pings WHERE user_id = ? ORDER BY at DESC')
  .all(userId);

export const forget = (userId) => sql().prepare('DELETE FROM afk_pings WHERE user_id = ?').run(userId);

/** discord relative time, so "went afk 2 hours ago" stays accurate. */
const stamp = (at) => (at ? `<t:${Math.floor(at / 1000)}:R>` : 'recently');

/** notices clean themselves up; nobody wants an afk receipt in the chat. */
const vanish = (message, ms) => setTimeout(() => message.delete().catch(() => {}), ms).unref?.();

/** who mentioned them, most recent first, six names at most. */
function summary(rows) {
  const counts = new Map();

  for (const row of rows) counts.set(row.from_id, (counts.get(row.from_id) ?? 0) + 1);

  const names = [...counts.entries()]
    .slice(0, 6)
    .map(([id, count]) => `<@${id}>${count > 1 ? ` ×${count}` : ''}`);

  const total = rows.length;

  return `${total} ping${total === 1 ? '' : 's'} while you were away — ${names.join(', ')}${counts.size > 6 ? ' and others' : ''}.`;
}

export function watch(client, log = () => {}) {
  client.on(Events.MessageCreate, async (message) => {
    if (!message.guild || message.author.bot) return;
    if ((message.content ?? '').startsWith(prefixChar)) return;

    try {
      const mine = await get(message.author.id);

      if (mine.isAfk) {
        await clear(message.author.id);

        const rows = pings(message.author.id);
        await forget(message.author.id);

        const line = rows.length
          ? `welcome back, **${message.author.username}** — back after ${stamp(mine.at)} *(${mine.reason ?? 'afk'})* · ${summary(rows)}`
          : `welcome back, **${message.author.username}** — you went afk ${stamp(mine.at)} *(${mine.reason ?? 'afk'})*`;

        const back = await message.reply({ content: line, allowedMentions: { parse: [] } }).catch(() => null);
        if (back) vanish(back, 8000);
      }

      for (const [, user] of message.mentions.users) {
        if (user.bot || user.id === message.author.id) continue;

        const theirs = await get(user.id);
        if (!theirs.isAfk) continue;

        if (user.id !== message.author.id) ping(user.id, message.author.id, message.channelId);

        const note = await message
          .reply({
            content: `**${user.username}** is afk ${stamp(theirs.at)} — *${theirs.reason ?? 'afk'}*`,
            allowedMentions: { parse: [] },
          })
          .catch(() => null);

        if (note) vanish(note, 7000);
      }
    } catch (error) {
      log('afk notice skipped —', error?.message ?? error);
    }
  });
}
