import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { db } from './db.js';

/**
 * economy — one wallet per user, shared across every server.
 *
 * mongo when MONGO_URI is set, otherwise data/economy.json. every command goes
 * through `update`, so a record is read, changed and written in one place and
 * the cooldowns live next to the money.
 */

export const currency = 'coins';

const file = path.join(process.cwd(), 'data', 'economy.json');

let cache = null;

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

async function load() {
  if (cache) return cache;

  let raw = {};

  try {
    raw = JSON.parse(await readFile(file, 'utf8'));
  } catch {
    raw = {};
  }

  cache = { users: raw?.users ?? {} };
  return cache;
}

async function save() {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(cache, null, 2)}\n`);
}

const rows = () => db()?.collection('economy');

/** a user's wallet, empty on first contact. */
export async function get(userId) {
  const table = rows();

  if (table) return shape((await table.findOne({ userId })) ?? { userId });

  const data = await load();
  return shape(data.users[userId] ?? { userId });
}

/** write a whole record back. */
export async function put(record) {
  const doc = shape(record);
  const table = rows();

  if (table) {
    await table.updateOne({ userId: doc.userId }, { $set: doc }, { upsert: true });
    return doc;
  }

  const data = await load();
  data.users[doc.userId] = doc;

  await save();
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
  const table = rows();

  if (table) {
    const docs = await table.aggregate([
      { $addFields: { total: { $add: ['$wallet', '$bank'] } } },
      { $sort: { total: -1 } },
      { $limit: limit },
    ]).toArray();

    return docs.map((doc) => ({
      userId: doc.userId,
      name: doc.name ?? null,
      wallet: doc.wallet ?? 0,
      bank: doc.bank ?? 0,
      total: doc.total ?? 0,
    }));
  }

  const data = await load();

  return Object.values(data.users)
    .map((row) => shape(row))
    .map((row) => ({ ...row, total: row.wallet + row.bank }))
    .filter((row) => row.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
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
