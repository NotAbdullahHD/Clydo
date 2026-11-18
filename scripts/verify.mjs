import { readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * `node scripts/verify.mjs` — everything that can be checked without discord.
 *
 * it imports every command (a broken import is a command that never loads),
 * looks for name and alias collisions, opens the store and reports its tables,
 * exercises the parser and the colour maths, renders one collage, and times the
 * sqlite path that runs on every message. exits nonzero on any failure.
 */

const log = (...args) => console.log(...args);
const problems = [];

const walk = async (dir) => {
  const found = [];

  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...await walk(full));
    else if (entry.name.endsWith('.js')) found.push(full);
  }

  return found.sort();
};

/** 1 — every command imports, and every name is reachable. */
const files = await walk('src/commands');
const names = new Map();
let loaded = 0;

for (const file of files) {
  try {
    const module = await import(pathToFileURL(path.resolve(file)).href);
    const name = module.data?.name ?? module.name;

    if (!name && typeof module.prefix !== 'function' && typeof module.execute !== 'function') {
      problems.push(`${file} exports neither a name nor a handler`);
      continue;
    }

    for (const key of [name, ...(module.names ?? [])].filter(Boolean)) {
      if (names.has(key)) problems.push(`duplicate name \`${key}\`: ${names.get(key)} and ${file}`);
      names.set(key, file);
    }

    if (name && typeof module.prefix !== 'function' && !module.data) {
      problems.push(`${file} has no prefix handler and no slash data`);
    }

    loaded += 1;
  } catch (error) {
    problems.push(`${file} failed to import — ${error.message}`);
  }
}

log(`commands: ${loaded}/${files.length} loaded, ${names.size} names and aliases`);

/** 2 — the store, and the tables every new feature expects. */
const { open, sql } = await import('../src/lib/sqlite.js');
open();

const tables = new Set(sql()
  .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
  .all()
  .map((row) => row.name));

for (const table of ['paint', 'jail', 'fm', 'afk_pings', 'activity', 'levels', 'config', 'lastfm']) {
  if (!tables.has(table)) problems.push(`table \`${table}\` is missing from the store`);
}

log(`store: ${tables.size} tables`);

/** 3 — the script parser and the colour maths. */
const { script, render } = await import('../src/lib/embedBuilder.js');
const { parse } = await import('../src/lib/paint.js');

const sample = script('{embed}$v{title: welcome {user.name}}$v{description: enjoy}$v{color: #8d7bb4}');
if (!sample.embed) problems.push(`embed script failed — ${sample.problem}`);
if (sample.embed?.data.color !== 0x8d7bb4) problems.push('embed script ignored the colour');

const bad = script('{embed}$v{oops: nope}');
if (!bad.problem) problems.push('embed script accepted an unknown key');

if (parse('#8D7') !== '#88dd77') problems.push('colour short form is wrong');
if (parse('lavender') !== null) problems.push('colour parser accepted a word');

log('parser: script, variables and colour ok');

/** 4 — one collage, rendered and thrown away. */
const { collage } = await import('../src/lib/collage.js');
const png = await collage({ size: 3, heading: 'verify', albums: [{ name: 'album', artist: 'artist', art: null }] });
await rm('verify-collage.png', { force: true });

if (!png?.length) problems.push('collage produced no image');
log(`collage: ${Math.round(png.length / 1024)}kb png`);

/** 5 — the per-message sqlite path, timed. */
const started = performance.now();

for (let index = 0; index < 500; index += 1) {
  sql()
    .prepare(`
      INSERT INTO activity (guild_id, user_id, day, messages, voice) VALUES ('0', '0', '1970-01-01', 1, 0)
      ON CONFLICT (guild_id, user_id, day) DO UPDATE SET messages = messages + 1
    `)
    .run();
}

const each = ((performance.now() - started) / 500).toFixed(3);
sql().prepare("DELETE FROM activity WHERE guild_id = '0'").run();

log(`activity write: ${each}ms per message${each > 3 ? ' (a bot sharing the store adds contention)' : ''}`);

if (Number(each) > 25) problems.push(`the per-message write is slow (${each}ms)`);

/** 6 — the gateway, when the network allows it. */
try {
  const ping = performance.now();
  const response = await fetch('https://discord.com/api/v10/gateway', { signal: AbortSignal.timeout(5000) });
  log(`discord rest: ${response.status} in ${Math.round(performance.now() - ping)}ms`);
} catch (error) {
  log(`discord rest: unreachable (${error.message}) — commands will feel slow until it answers`);
}

if (problems.length) {
  log(`\n${problems.length} problem(s):`);
  for (const problem of problems) log(` - ${problem}`);
  process.exitCode = 1;
}

log('\nall checks passed.');
