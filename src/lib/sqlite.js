import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

/**
 * the store.
 *
 * one sqlite file under data/, opened once at boot and written synchronously —
 * the bot answers a command in milliseconds, so there is nothing to gain from
 * async plumbing and a lot to lose from read-modify-write races. every table is
 * keyed the way its json file was, so the import below is a straight copy.
 */

const file = () => path.join(process.cwd(), 'data', 'slink.db');

const schema = `
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = NORMAL;
  PRAGMA busy_timeout = 4000;

  CREATE TABLE IF NOT EXISTS counts (
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    count INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (guild_id, user_id)
  ) WITHOUT ROWID;

  CREATE TABLE IF NOT EXISTS guilds (
    guild_id TEXT PRIMARY KEY,
    enabled INTEGER NOT NULL DEFAULT 1,
    banned TEXT NOT NULL DEFAULT '[]'
  ) WITHOUT ROWID;

  CREATE TABLE IF NOT EXISTS awards (
    guild_id TEXT NOT NULL,
    message_id TEXT NOT NULL,
    reactor_id TEXT NOT NULL,
    author_id TEXT NOT NULL,
    at INTEGER NOT NULL,
    PRIMARY KEY (guild_id, message_id, reactor_id)
  ) WITHOUT ROWID;

  CREATE INDEX IF NOT EXISTS awards_at ON awards (at);

  CREATE TABLE IF NOT EXISTS economy (
    user_id TEXT PRIMARY KEY,
    name TEXT,
    wallet INTEGER NOT NULL DEFAULT 0,
    bank INTEGER NOT NULL DEFAULT 0,
    inventory TEXT NOT NULL DEFAULT '{}',
    daily_at INTEGER NOT NULL DEFAULT 0,
    daily_streak INTEGER NOT NULL DEFAULT 0,
    work_at INTEGER NOT NULL DEFAULT 0,
    beg_at INTEGER NOT NULL DEFAULT 0,
    bonus_at INTEGER NOT NULL DEFAULT 0
  ) WITHOUT ROWID;

  CREATE TABLE IF NOT EXISTS family (
    user_id TEXT PRIMARY KEY,
    partner_id TEXT,
    parent TEXT,
    children TEXT NOT NULL DEFAULT '[]'
  ) WITHOUT ROWID;

  CREATE TABLE IF NOT EXISTS honeypot (
    guild_id TEXT PRIMARY KEY,
    enabled INTEGER NOT NULL DEFAULT 0,
    channel_id TEXT,
    notice_id TEXT,
    punishment TEXT NOT NULL DEFAULT 'ban',
    message TEXT,
    counts TEXT NOT NULL DEFAULT '{}'
  ) WITHOUT ROWID;

  CREATE TABLE IF NOT EXISTS afk (
    user_id TEXT PRIMARY KEY,
    is_afk INTEGER NOT NULL DEFAULT 0,
    reason TEXT,
    at INTEGER
  ) WITHOUT ROWID;

  CREATE TABLE IF NOT EXISTS appearance (
    guild_id TEXT PRIMARY KEY,
    avatar TEXT,
    banner TEXT,
    bio TEXT
  ) WITHOUT ROWID;

  CREATE TABLE IF NOT EXISTS lastfm (
    user_id TEXT PRIMARY KEY,
    username TEXT NOT NULL
  ) WITHOUT ROWID;

  CREATE TABLE IF NOT EXISTS scores (
    feature TEXT NOT NULL,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    username TEXT,
    score INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (feature, guild_id, user_id)
  ) WITHOUT ROWID;

  CREATE TABLE IF NOT EXISTS config (
    guild_id TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    PRIMARY KEY (guild_id, key)
  ) WITHOUT ROWID;

  CREATE TABLE IF NOT EXISTS starboards (
    guild_id TEXT NOT NULL,
    message_id TEXT NOT NULL,
    board_id TEXT NOT NULL,
    PRIMARY KEY (guild_id, message_id)
  ) WITHOUT ROWID;

  CREATE TABLE IF NOT EXISTS levels (
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    xp INTEGER NOT NULL DEFAULT 0,
    at INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (guild_id, user_id)
  ) WITHOUT ROWID;

  CREATE TABLE IF NOT EXISTS activity (
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    day TEXT NOT NULL,
    messages INTEGER NOT NULL DEFAULT 0,
    voice INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (guild_id, user_id, day)
  ) WITHOUT ROWID;

  CREATE TABLE IF NOT EXISTS voice (
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    seconds INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (guild_id, user_id)
  ) WITHOUT ROWID;
`;

let database = null;

/** open (and create) the store. safe to call more than once. */
export function open() {
  if (database) return database;

  mkdirSync(path.dirname(file()), { recursive: true });

  database = new DatabaseSync(file());
  database.exec(schema);

  return database;
}

/** the connection, opening it on first use. */
export const sql = () => database ?? open();

export function close() {
  database?.close();
  database = null;
}
