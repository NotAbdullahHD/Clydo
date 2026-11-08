import { sql } from './sqlite.js';

/** one last.fm username per discord user. */

export async function getUser(userId) {
  const row = sql().prepare('SELECT username FROM lastfm WHERE user_id = ?').get(userId);

  return row?.username ?? null;
}

export async function setUser(userId, username) {
  sql()
    .prepare(`
      INSERT INTO lastfm (user_id, username) VALUES (?, ?)
      ON CONFLICT (user_id) DO UPDATE SET username = excluded.username
    `)
    .run(userId, username);

  return username;
}
