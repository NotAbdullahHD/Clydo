import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { db } from './db.js';

/**
 * families — partner, parent and children, keyed by user and shared across
 * servers, exactly the shape labubu's Family model had.
 *
 * mongo when MONGO_URI is set, otherwise data/family.json.
 */

const file = path.join(process.cwd(), 'data', 'family.json');
let cache = null;

const shape = (doc) => ({
  userId: doc.userId,
  partnerId: doc.partnerId ?? null,
  parent: doc.parent ?? null,
  children: [...(doc.children ?? [])],
});

async function load() {
  if (cache) return cache;

  let raw = {};

  try {
    raw = JSON.parse(await readFile(file, 'utf8'));
  } catch {
    raw = {};
  }

  cache = { families: raw?.families ?? {} };
  return cache;
}

async function saveJson() {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(cache, null, 2)}\n`);
}

const rows = () => db()?.collection('family');

/** the user's family record, created empty on first use. */
export async function get(userId) {
  const table = rows();

  if (table) {
    await table.updateOne(
      { userId },
      { $setOnInsert: { partnerId: null, parent: null, children: [] } },
      { upsert: true },
    );

    return shape(await table.findOne({ userId }));
  }

  const data = await load();
  data.families[userId] = shape(data.families[userId] ?? { userId });

  return data.families[userId];
}

/** write a record back. */
export async function save(record) {
  const table = rows();
  const next = shape(record);

  if (table) {
    await table.updateOne(
      { userId: next.userId },
      { $set: { partnerId: next.partnerId, parent: next.parent, children: next.children } },
      { upsert: true },
    );

    return next;
  }

  const data = await load();
  data.families[next.userId] = next;
  await saveJson();

  return next;
}
