import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { EmbedBuilder } from 'discord.js';
import { sql } from './sqlite.js';
import { palette } from './theme.js';

/**
 * economy — one wallet per user, shared across every server.
 *
 * every command goes through `update`, so a record is read, changed and written
 * in one place and the cooldowns live next to the money.
 */

export const currency = 'coins';

/** the two glyphs the economy uses, nothing more. */
export const coin = '🟡';
export const bank = '🏦';

/** 191900 → 191.9K, 1500000 → 1.5M — never a wall of digits. */
export function short(value) {
  const n = Math.round(Number(value) || 0);
  if (n < 1_000) return String(n);

  const units = [[1_000_000_000, 'B'], [1_000_000, 'M'], [1_000, 'K']];
  const trim = (number) => number.toFixed(1).replace(/\.0$/, '');

  for (let index = 1; index < units.length; index += 1) {
    const [size, suffix] = units[index];
    if (n < size) continue;

    const scaled = Math.round((n / size) * 10) / 10;

    /* 999,999 rounds to 1000K — carry it into the next unit instead. */
    if (scaled >= 1_000) {
      const [bigger, bigSuffix] = units[index - 1];
      return `${trim(Math.round((n / bigger) * 10) / 10)}${bigSuffix}`;
    }

    return `${trim(scaled)}${suffix}`;
  }

  return `${trim(Math.round((n / units[0][0]) * 10) / 10)}${units[0][1]}`;
}

/** ✅ one line, green. */
export const good = (text) => new EmbedBuilder().setColor(palette.good).setDescription(`✅ ${text}`);

/** ❌ one line, red. */
export const bad = (text) => new EmbedBuilder().setColor(palette.bad).setDescription(`❌ ${text}`);

/** a plain card on discord's own grey. */
export const card = (title, description) => new EmbedBuilder()
  .setColor(palette.panel)
  .setTitle(title)
  .setDescription(description);

const shape = (doc) => ({
  userId: doc.userId,
  name: doc.name ?? null,
  wallet: Math.max(0, Math.floor(Number(doc.wallet) || 0)),
  bank: Math.max(0, Math.floor(Number(doc.bank) || 0)),
  inventory: { ...(doc.inventory ?? {}) },
  daily: { at: Number(doc.daily?.at) || 0, streak: Number(doc.daily?.streak) || 0 },
  work: { at: Number(doc.work?.at) || 0 },
  beg: { at: Number(doc.beg?.at) || 0 },
  bonus: { at: Number(doc.bonus?.at) || 0 },
});

/** a user's wallet, empty on first contact. */
export async function get(userId) {
  const row = sql().prepare('SELECT * FROM economy WHERE user_id = ?').get(userId);

  if (!row) return shape({ userId });

  return shape({
    userId: row.user_id,
    name: row.name,
    wallet: row.wallet,
    bank: row.bank,
    inventory: JSON.parse(row.inventory),
    daily: { at: row.daily_at, streak: row.daily_streak },
    work: { at: row.work_at },
    beg: { at: row.beg_at },
    bonus: { at: row.bonus_at },
  });
}

/** write a whole record back. */
export async function put(record) {
  const doc = shape(record);

  sql()
    .prepare(`
      INSERT INTO economy
        (user_id, name, wallet, bank, inventory, daily_at, daily_streak, work_at, beg_at, bonus_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (user_id) DO UPDATE SET
        name = excluded.name,
        wallet = excluded.wallet,
        bank = excluded.bank,
        inventory = excluded.inventory,
        daily_at = excluded.daily_at,
        daily_streak = excluded.daily_streak,
        work_at = excluded.work_at,
        beg_at = excluded.beg_at,
        bonus_at = excluded.bonus_at
    `)
    .run(
      doc.userId,
      doc.name,
      doc.wallet,
      doc.bank,
      JSON.stringify(doc.inventory),
      doc.daily.at,
      doc.daily.streak,
      doc.work.at,
      doc.beg.at,
      doc.bonus.at,
    );

  return doc;
}

/** read, change, write — the only way a balance should ever move. */
export async function update(userId, change, name = null) {
  const record = await get(userId);
  const next = shape(change(record) ?? record);

  if (name) next.name = name;

  return put(next);
}

/** best wallets first, wallet + bank together. */
export async function top(limit = 10) {
  const rows = sql()
    .prepare(`
      SELECT user_id, name, wallet, bank, wallet + bank AS total
      FROM economy
      WHERE wallet + bank > 0
      ORDER BY total DESC, user_id ASC
      LIMIT ?
    `)
    .all(limit);

  return rows.map((row) => ({
    userId: row.user_id,
    name: row.name ?? null,
    wallet: row.wallet,
    bank: row.bank,
    total: row.total,
  }));
}

/** 12345 → 12,345 */
export const money = (value) => Math.round(Number(value) || 0).toLocaleString('en-US');

/** wallet + bank */
export const total = (record) => record.wallet + record.bank;

/** 3_725_000 → "1h 2m" */
export function left(ms) {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

/** "500", "1,200", "all" → a number, or null when it is not one. */
export function amount(input, ceiling = Infinity) {
  if (!input) return null;
  if (input.toLowerCase() === 'all') return ceiling === Infinity ? null : ceiling;

  const value = Math.floor(Number(String(input).replace(/[,_]/g, '')));

  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
}
