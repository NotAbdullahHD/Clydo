import { cached, set } from './config.js';

/**
 * server aliases.
 *
 * `,ui` for `,userinfo` is a taste call; the server making `,meme` mean
 * `,google meme` means is not, so aliases are per guild and live in config.
 * a custom alias can never shadow a real command — the router checks commands
 * first, so a stale alias just stops being reachable instead of breaking a name.
 */

const key = 'aliases';

export const limit = 40;
export const pattern = /^[a-z0-9_-]{1,20}$/;

export const all = (guildId) => cached(guildId, key) ?? {};

export const resolve = (guildId, name) => all(guildId)[name] ?? null;

export function put(guildId, short, target) {
  const name = String(short ?? '').toLowerCase();

  if (!pattern.test(name)) return { error: 'an alias is 1–20 characters: letters, numbers, `_` or `-`.' };
  if (name === target) return { error: 'that is already the command name.' };

  const map = all(guildId);
  if (!map[name] && Object.keys(map).length >= limit) {
    return { error: `this server already has ${limit} aliases.` };
  }

  set(guildId, key, { ...map, [name]: target });

  return { alias: name, target };
}

export function drop(guildId, short) {
  const name = String(short ?? '').toLowerCase();
  const map = all(guildId);

  if (!map[name]) return null;

  const next = { ...map };
  delete next[name];
  set(guildId, key, Object.keys(next).length ? next : null);

  return next;
}

/** aliases pointing at one command, for the help card. */
export const of = (guildId, target) => Object.entries(all(guildId))
  .filter(([, value]) => value === target)
  .map(([name]) => name);
