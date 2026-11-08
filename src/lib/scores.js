import { sql } from './sqlite.js';

/**
 * one score table per feature, scoped per server, all in one sqlite table.
 *
 * the feature name is the first key so flags and trivia share the shape without
 * sharing rows: add a point, read a page, count the players.
 */

export function scoreStore({ feature }) {
  return {
    /** one win. returns the player's new score. */
    async add(guildId, userId, username) {
      const row = sql()
        .prepare(`
          INSERT INTO scores (feature, guild_id, user_id, username, score) VALUES (?, ?, ?, ?, 1)
          ON CONFLICT (feature, guild_id, user_id)
          DO UPDATE SET score = scores.score + 1, username = excluded.username
          RETURNING score
        `)
        .get(feature, guildId, userId, username);

      return row?.score ?? 0;
    },

    /** one page of the table, best first. */
    async board(guildId, limit = 10, skip = 0) {
      return sql()
        .prepare(`
          SELECT user_id AS userId, username, score FROM scores
          WHERE feature = ? AND guild_id = ?
          ORDER BY score DESC, user_id ASC
          LIMIT ? OFFSET ?
        `)
        .all(feature, guildId, limit, skip);
    },

    /** how many players have a score — used for page counts. */
    async total(guildId) {
      const row = sql()
        .prepare('SELECT COUNT(*) AS players FROM scores WHERE feature = ? AND guild_id = ?')
        .get(feature, guildId);

      return row?.players ?? 0;
    },
  };
}
