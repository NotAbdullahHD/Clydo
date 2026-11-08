import { readFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { sql } from './sqlite.js';

/**
 * one-time lift of data/*.json into sqlite.
 *
 * the json files were the fallback while mongo existed, and they are the only
 * copy of the live counts, so they are imported rather than thrown away. each
 * file is parked as *.migrated afterwards, which makes a second boot a no-op and
 * leaves the old data on disk in case something needs to be checked by hand.
 */

const at = (name) => path.join(process.cwd(), 'data', name);

async function read(name) {
  try {
    return JSON.parse(await readFile(at(name), 'utf8'));
  } catch {
    return null;
  }
}

const park = (name) => rename(at(name), `${at(name)}.migrated`).catch(() => {});

const rows = (table) => sql().prepare(`SELECT COUNT(*) AS n FROM ${table}`).get()?.n ?? 0;

export async function migrate(log = () => {}) {
  let imported = 0;

  /* ── sobs: counts, guild settings, award ledger ───────────── */

  const sobs = await read('sobs.json');

  if (sobs && rows('counts') === 0) {
    // the oldest file was a flat "guild:user": count map with no ledger.
    const counts = sobs.counts ?? sobs;
    const insertCount = sql().prepare(`
      INSERT INTO counts (guild_id, user_id, count) VALUES (?, ?, ?)
      ON CONFLICT (guild_id, user_id) DO UPDATE SET count = excluded.count
    `);

    for (const [key, value] of Object.entries(counts ?? {})) {
      const [guildId, userId] = key.split(':');
      if (!guildId || !userId || typeof value !== 'number') continue;

      insertCount.run(guildId, userId, Math.max(0, Math.floor(value)));
      imported += 1;
    }

    const insertGuild = sql().prepare(`
      INSERT INTO guilds (guild_id, enabled, banned) VALUES (?, ?, ?)
      ON CONFLICT (guild_id) DO UPDATE SET enabled = excluded.enabled, banned = excluded.banned
    `);

    for (const [guildId, record] of Object.entries(sobs.guilds ?? {})) {
      insertGuild.run(guildId, record.enabled === false ? 0 : 1, JSON.stringify(record.banned ?? []));
      imported += 1;
    }

    const insertAward = sql().prepare(`
      INSERT OR IGNORE INTO awards (guild_id, message_id, reactor_id, author_id, at) VALUES (?, ?, ?, ?, ?)
    `);

    for (const [key, meta] of Object.entries(sobs.awards ?? {})) {
      const [guildId, messageId, reactorId] = key.split(':');
      if (!guildId || !messageId || !reactorId) continue;

      insertAward.run(guildId, messageId, reactorId, meta?.authorId ?? '', Number(meta?.at) || Date.now());
      imported += 1;
    }

    await park('sobs.json');
    log(`  imported ${imported} sob row(s).`);
  }

  /* ── economy ──────────────────────────────────────────────── */

  const economy = await read('economy.json');

  if (economy?.users && rows('economy') === 0) {
    const insert = sql().prepare(`
      INSERT OR REPLACE INTO economy
        (user_id, name, wallet, bank, inventory, daily_at, daily_streak, work_at, beg_at, bonus_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const [userId, record] of Object.entries(economy.users)) {
      insert.run(
        userId,
        record?.name ?? null,
        Math.max(0, Math.floor(Number(record?.wallet) || 0)),
        Math.max(0, Math.floor(Number(record?.bank) || 0)),
        JSON.stringify(record?.inventory ?? {}),
        Number(record?.daily?.at) || 0,
        Number(record?.daily?.streak) || 0,
        Number(record?.work?.at) || 0,
        Number(record?.beg?.at) || 0,
        Number(record?.bonus?.at) || 0,
      );
      imported += 1;
    }

    await park('economy.json');
  }

  /* ── game scores ──────────────────────────────────────────── */

  for (const feature of ['flags', 'trivia']) {
    const scores = await read(`${feature}.json`);
    if (!scores?.scores || rows('scores') === 0) {
      if (!scores?.scores) continue;
    }

    const insert = sql().prepare(`
      INSERT OR REPLACE INTO scores (feature, guild_id, user_id, username, score) VALUES (?, ?, ?, ?, ?)
    `);

    for (const [key, entry] of Object.entries(scores.scores)) {
      const [guildId, userId] = key.split(':');
      if (!guildId || !userId) continue;

      const already = sql()
        .prepare('SELECT score FROM scores WHERE feature = ? AND guild_id = ? AND user_id = ?')
        .get(feature, guildId, userId);

      if (already) continue;

      insert.run(feature, guildId, userId, entry?.username ?? null, Math.max(0, Math.floor(Number(entry?.score) || 0)));
      imported += 1;
    }

    await park(`${feature}.json`);
  }

  /* ── family ───────────────────────────────────────────────── */

  const family = await read('family.json');

  if (family?.families && rows('family') === 0) {
    const insert = sql().prepare(`
      INSERT OR REPLACE INTO family (user_id, partner_id, parent, children) VALUES (?, ?, ?, ?)
    `);

    for (const [userId, record] of Object.entries(family.families)) {
      insert.run(userId, record?.partnerId ?? null, record?.parent ?? null, JSON.stringify(record?.children ?? []));
      imported += 1;
    }

    await park('family.json');
  }

  /* ── honeypot ─────────────────────────────────────────────── */

  const honeypot = await read('honeypot.json');

  if (honeypot?.guilds && rows('honeypot') === 0) {
    const insert = sql().prepare(`
      INSERT OR REPLACE INTO honeypot
        (guild_id, enabled, channel_id, notice_id, punishment, message, counts)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    for (const [guildId, record] of Object.entries(honeypot.guilds)) {
      insert.run(
        guildId,
        record?.enabled ? 1 : 0,
        record?.channelId ?? null,
        record?.noticeId ?? null,
        record?.punishment ?? 'ban',
        record?.message ?? null,
        JSON.stringify(record?.counts ?? {}),
      );
      imported += 1;
    }

    await park('honeypot.json');
  }

  /* ── afk ──────────────────────────────────────────────────── */

  const afk = await read('afk.json');

  if (afk?.afk && rows('afk') === 0) {
    const insert = sql().prepare(`
      INSERT OR REPLACE INTO afk (user_id, is_afk, reason, at) VALUES (?, ?, ?, ?)
    `);

    for (const [userId, record] of Object.entries(afk.afk)) {
      insert.run(userId, record?.isAfk ? 1 : 0, record?.reason ?? null, Number(record?.at) || null);
      imported += 1;
    }

    await park('afk.json');
  }

  /* ── per-server appearance ────────────────────────────────── */

  const appearance = await read('appearance.json');

  if (appearance?.servers && rows('appearance') === 0) {
    const insert = sql().prepare(`
      INSERT OR REPLACE INTO appearance (guild_id, avatar, banner, bio) VALUES (?, ?, ?, ?)
    `);

    for (const [guildId, record] of Object.entries(appearance.servers)) {
      insert.run(guildId, record?.avatar ?? null, record?.banner ?? null, record?.bio ?? null);
      imported += 1;
    }

    await park('appearance.json');
  }

  /* ── last.fm handles ──────────────────────────────────────── */

  const lastfm = await read('lastfm.json');

  if (lastfm?.users && rows('lastfm') === 0) {
    const insert = sql().prepare('INSERT OR REPLACE INTO lastfm (user_id, username) VALUES (?, ?)');

    for (const [userId, username] of Object.entries(lastfm.users)) {
      if (typeof username !== 'string' || !username) continue;
      insert.run(userId, username);
      imported += 1;
    }

    await park('lastfm.json');
  }

  return imported;
}
