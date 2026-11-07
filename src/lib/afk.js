import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Events } from 'discord.js';
import { db } from './db.js';
import { prefix as prefixChar } from './prefix.js';

/**
 * afk — one record per user, shared across every server, the same shape
 * labubu's User.afk had. mongo when MONGO_URI is set, otherwise data/afk.json.
 */

const file = path.join(process.cwd(), 'data', 'afk.json');

let cache = null;

const shape = (doc) => ({
  isAfk: Boolean(doc?.isAfk),
  reason: doc?.reason ?? null,
  at: doc?.at ?? null,
});

async function load() {
  if (cache) return cache;

  let raw = {};

  try {
    raw = JSON.parse(await readFile(file, 'utf8'));
  } catch {
    raw = {};
  }

  cache = { afk: raw?.afk ?? {} };
  return cache;
}

async function save() {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(cache, null, 2)}\n`);
}

const rows = () => db()?.collection('afk');

/** mark a user afk. returns when it started. */
export async function set(userId, reason) {
  const at = Date.now();
  const table = rows();

  if (table) {
    await table.updateOne({ userId }, { $set: { isAfk: true, reason, at } }, { upsert: true });
    return at;
  }

  const data = await load();
  data.afk[userId] = { isAfk: true, reason, at };

  await save();
  return at;
}

/** a user's record, empty when they have never gone afk. */
export async function get(userId) {
  const table = rows();
  if (table) return shape(await table.findOne({ userId }));

  const data = await load();
  return shape(data.afk[userId]);
}

/** clear it — on their next message, or on request. */
export async function clear(userId) {
  const table = rows();

  if (table) {
    await table.updateOne({ userId }, { $set: { isAfk: false, reason: null, at: null } });
    return;
  }

  const data = await load();
  if (!data.afk[userId]) return;

  data.afk[userId] = { isAfk: false, reason: null, at: null };
  await save();
}

/** discord relative time, so "went afk 2 hours ago" stays accurate. */
const stamp = (at) => (at ? `<t:${Math.floor(at / 1000)}:R>` : 'recently');

/** notices clean themselves up; nobody wants an afk receipt in the chat. */
const vanish = (message, ms) => setTimeout(() => message.delete().catch(() => {}), ms).unref?.();

/**
 * two jobs on every message: welcome an afk member back, and tell anyone who
 * pings an afk member that they are away. commands are skipped, otherwise
 * ,afk would set the status and clear it in the same breath.
 */
export function watch(client, log = () => {}) {
  client.on(Events.MessageCreate, async (message) => {
    if (!message.guild || message.author.bot) return;
    if ((message.content ?? '').startsWith(prefixChar)) return;

    try {
      const mine = await get(message.author.id);

      if (mine.isAfk) {
        await clear(message.author.id);

        const back = await message
          .reply(`welcome back, **${message.author.username}** — you went afk ${stamp(mine.at)} *(${mine.reason ?? 'afk'})*`)
          .catch(() => null);

        if (back) vanish(back, 6000);
      }

      for (const [, user] of message.mentions.users) {
        if (user.bot || user.id === message.author.id) continue;

        const theirs = await get(user.id);
        if (!theirs.isAfk) continue;

        const note = await message
          .reply(`**${user.username}** is afk ${stamp(theirs.at)} — *${theirs.reason ?? 'afk'}*`)
          .catch(() => null);

        if (note) vanish(note, 7000);
      }
    } catch (error) {
      log('afk notice skipped —', error?.message ?? error);
    }
  });
}
