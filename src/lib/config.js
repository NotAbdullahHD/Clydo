import { sql } from './sqlite.js';

/**
 * per-guild settings.
 *
 * one row per key with json in the value, so a feature can grow a field without
 * a migration. the message-event path (automod, starboard, reaction roles) reads
 * on every message, so reads are cached for half a minute; every write clears
 * the cache for that key instead of expiring it early.
 */

const cache = new Map();
const ttl = 30_000;

const cacheKey = (guildId, key) => `${guildId}:${key}`;

export function get(guildId, key) {
  const row = sql()
    .prepare('SELECT value FROM config WHERE guild_id = ? AND key = ?')
    .get(guildId, key);

  if (!row) return null;

  try {
    return JSON.parse(row.value);
  } catch {
    return null;
  }
}

export function set(guildId, key, value) {
  cache.delete(cacheKey(guildId, key));

  if (value === null || value === undefined) {
    sql().prepare('DELETE FROM config WHERE guild_id = ? AND key = ?').run(guildId, key);
    return null;
  }

  sql()
    .prepare(`
      INSERT INTO config (guild_id, key, value) VALUES (?, ?, ?)
      ON CONFLICT (guild_id, key) DO UPDATE SET value = excluded.value
    `)
    .run(guildId, key, JSON.stringify(value));

  return value;
}

/** merge a patch into an object setting. */
export function patch(guildId, key, change) {
  const current = get(guildId, key) ?? {};
  return set(guildId, key, { ...current, ...change });
}

/** the cached read for hot paths. `set`/`patch` invalidate automatically. */
export function cached(guildId, key, life = ttl) {
  const id = cacheKey(guildId, key);
  const hit = cache.get(id);
  const now = Date.now();

  if (hit && hit.until > now) return hit.value;

  const value = get(guildId, key);
  cache.set(id, { value, until: now + life });

  return value;
}

/** drop every cached key for a guild — used when a feature is switched off. */
export function forget(guildId) {
  for (const id of cache.keys()) {
    if (id.startsWith(`${guildId}:`)) cache.delete(id);
  }
}
