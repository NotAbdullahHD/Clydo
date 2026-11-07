import { MongoClient } from 'mongodb';

/**
 * mongo is optional. with MONGO_URI set, counts and server settings live in a
 * real database; without it everything falls back to data/sobs.json so the bot
 * still runs on a fresh checkout.
 */

let client = null;
let database = null;

/** the connected database, or null while falling back to json. */
export const db = () => database;

export async function connect(uri, fallbackName = 'clydo', log = () => {}) {
  if (!uri) {
    log('no MONGO_URI — counts stay in data/sobs.json.');
    return null;
  }

  try {
    client = new MongoClient(uri, { serverSelectionTimeoutMS: 8000 });
    await client.connect();

    // the database lives in the uri path; ignore an empty one.
    const fromUri = new URL(uri).pathname.replace(/^\//, '');
    database = client.db(fromUri || fallbackName);

    await database.command({ ping: 1 });

    await database.collection('counts').createIndex({ guildId: 1, userId: 1 }, { unique: true });
    await database.collection('guilds').createIndex({ guildId: 1 }, { unique: true });
    await database.collection('flags').createIndex({ guildId: 1, userId: 1 }, { unique: true });
    await database.collection('trivia').createIndex({ guildId: 1, userId: 1 }, { unique: true });
    await database.collection('lastfm').createIndex({ userId: 1 }, { unique: true });
    await database.collection('awards').createIndex({ guildId: 1, messageId: 1, reactorId: 1 }, { unique: true });
    // old awards are pruned by the server, so the ledger cannot grow forever.
    await database.collection('awards').createIndex({ at: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

    log(`mongo connected — database "${database.databaseName}".`);
    return database;
  } catch (error) {
    log(`mongo unavailable — falling back to data/sobs.json. (${error.message})`);
    database = null;
    return null;
  }
}

export async function close() {
  await client?.close().catch(() => {});
  client = null;
  database = null;
}
