import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { db } from './db.js';

/** one last.fm username per discord user — mongo when configured, else json. */

const file = path.join(process.cwd(), 'data', 'lastfm.json');
let cache = null;

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

export async function getUser(userId) {
  const rows = db()?.collection('lastfm');

  if (rows) {
    const doc = await rows.findOne({ userId });
    return doc?.username ?? null;
  }

  const data = await load();
  return data.users[userId] ?? null;
}

export async function setUser(userId, username) {
  const rows = db()?.collection('lastfm');

  if (rows) {
    await rows.updateOne({ userId }, { $set: { username } }, { upsert: true });
    return username;
  }

  const data = await load();
  data.users[userId] = username;
  await save();

  return username;
}
