import { sql } from './sqlite.js';

/**
 * sob counts, per-server settings, and the award ledger.
 *
 * every credit is recorded in `awards` as guild + message + reactor. that is the
 * anti-farm guard: removing and re-adding one reaction cannot pay twice, and a
 * second bot session that also saw the event cannot credit it again.
 */

/** awards older than this are pruned — long enough that no old reaction pays twice. */
const awardTtl = 30 * 24 * 60 * 60 * 1000;

/** drop ledger entries past the ttl so the table cannot grow forever. */
const prune = () => {
  sql().prepare('DELETE FROM awards WHERE at < ?').run(Date.now() - awardTtl);
};

export async function count(guildId, userId) {
  const row = sql()
    .prepare('SELECT count FROM counts WHERE guild_id = ? AND user_id = ?')
    .get(guildId, userId);

  return row?.count ?? 0;
}

/** add (or remove, with a negative amount) sobs and return the new total. */
export async function addSobs(guildId, userId, amount) {
  const row = sql()
    .prepare(`
      INSERT INTO counts (guild_id, user_id, count)
      VALUES (?, ?, MAX(0, ?))
      ON CONFLICT (guild_id, user_id) DO UPDATE SET count = MAX(0, counts.count + ?)
      RETURNING count
    `)
    .get(guildId, userId, amount, amount);

  return row?.count ?? 0;
}

/**
 * credit one sob for a reaction. returns the author's new total, or null when
 * this reactor already paid for this message.
 */
export async function award(guildId, messageId, reactorId, authorId) {
  try {
    sql()
      .prepare('INSERT INTO awards (guild_id, message_id, reactor_id, author_id, at) VALUES (?, ?, ?, ?, ?)')
      .run(guildId, messageId, reactorId, authorId, Date.now());
  } catch (error) {
    // duplicate key — this reactor was already counted on this message.
    if (String(error?.message ?? '').includes('UNIQUE')) return null;
    throw error;
  }

  prune();
  return addSobs(guildId, authorId, 1);
}

/**
 * take a sob back when the reaction is removed. returns the author's new total,
 * or null when that reactor had never been counted.
 */
export async function revoke(guildId, messageId, reactorId) {
  const row = sql()
    .prepare('SELECT author_id FROM awards WHERE guild_id = ? AND message_id = ? AND reactor_id = ?')
    .get(guildId, messageId, reactorId);

  if (!row) return null;

  sql()
    .prepare('DELETE FROM awards WHERE guild_id = ? AND message_id = ? AND reactor_id = ?')
    .run(guildId, messageId, reactorId);

  return addSobs(guildId, row.author_id, -1);
}

/** every counted member in a server, highest first. */
export async function board(guildId) {
  return sql()
    .prepare('SELECT user_id AS userId, count FROM counts WHERE guild_id = ? ORDER BY count DESC LIMIT 100')
    .all(guildId);
}

/** enabled flag and ban list. enabled defaults to true. */
export async function settings(guildId) {
  const row = sql().prepare('SELECT enabled, banned FROM guilds WHERE guild_id = ?').get(guildId);

  return {
    enabled: row ? Boolean(row.enabled) : true,
    banned: row ? JSON.parse(row.banned) : [],
  };
}

export async function setEnabled(guildId, enabled) {
  sql()
    .prepare(`
      INSERT INTO guilds (guild_id, enabled) VALUES (?, ?)
      ON CONFLICT (guild_id) DO UPDATE SET enabled = excluded.enabled
    `)
    .run(guildId, enabled ? 1 : 0);

  return enabled;
}

export async function setBanned(guildId, userId, banned) {
  const record = await settings(guildId);
  const list = new Set(record.banned);

  if (banned) list.add(userId);
  else list.delete(userId);

  sql()
    .prepare(`
      INSERT INTO guilds (guild_id, enabled, banned) VALUES (?, ?, ?)
      ON CONFLICT (guild_id) DO UPDATE SET banned = excluded.banned
    `)
    .run(guildId, record.enabled ? 1 : 0, JSON.stringify([...list]));

  return banned;
}
