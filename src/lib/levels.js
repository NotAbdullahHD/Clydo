import { Events } from 'discord.js';
import { bumpMessage } from './activity.js';
import { sql } from './sqlite.js';

/**
 * levels.
 *
 * one xp row per member per server, earned by talking: 15–25 xp a message, at
 * most once a minute, so a spammer cannot outrun somebody who actually talks.
 * the curve is the one everybody knows — 100 xp to level 1, 155 more to level 2,
 * 220 more to level 3 — which is why a level 1 card can read `12 / 155`.
 *
 * a role named `lvl 4` is handed out on reaching level 4. that is the only way
 * rewards are configured, so there is no command to learn and no id to store.
 */

export const gain = { min: 15, max: 25 };
export const cooldown = 60_000;

/** xp to go from `level` to `level + 1`. */
export const needed = (level) => 5 * level ** 2 + 50 * level + 100;

/** everything the levels below `level` cost, from zero. */
export function totalFor(level) {
  let sum = 0;
  for (let step = 0; step < level; step += 1) sum += needed(step);
  return sum;
}

export function levelOf(xp) {
  let level = 0;
  while (xp >= totalFor(level + 1)) level += 1;
  return level;
}

const read = (guildId, userId) => sql()
  .prepare('SELECT xp, at FROM levels WHERE guild_id = ? AND user_id = ?')
  .get(guildId, userId) ?? { xp: 0, at: 0 };

export function profile(guildId, userId) {
  const row = read(guildId, userId);
  const level = levelOf(row.xp);
  const floor = totalFor(level);
  const span = needed(level);
  const into = row.xp - floor;

  const above = sql()
    .prepare('SELECT COUNT(*) AS n FROM levels WHERE guild_id = ? AND xp > ?')
    .get(guildId, row.xp)?.n ?? 0;

  return {
    xp: row.xp,
    level,
    into,
    span,
    rank: above + 1,
    percent: Math.max(0, Math.min(100, Math.round((into / span) * 100))),
  };
}

/** one message worth of xp, or null while the minute is still running. */
export function award(guildId, userId) {
  const now = Date.now();
  const row = read(guildId, userId);

  if (row.at && now - row.at < cooldown) return null;

  const xp = row.xp + gain.min + Math.floor(Math.random() * (gain.max - gain.min + 1));

  sql()
    .prepare(`
      INSERT INTO levels (guild_id, user_id, xp, at) VALUES (?, ?, ?, ?)
      ON CONFLICT (guild_id, user_id) DO UPDATE SET xp = excluded.xp, at = excluded.at
    `)
    .run(guildId, userId, xp, now);

  return { before: levelOf(row.xp), after: levelOf(xp), xp };
}

/** every `lvl <n>` role in the server, lowest level first. */
export function ladder(guild) {
  return [...guild.roles.cache.values()]
    .map((role) => ({ role, level: Number(role.name.match(/^lvl\s*(\d+)$/i)?.[1]) }))
    .filter((entry) => entry.level > 0)
    .sort((a, b) => a.level - b.level);
}

/** the first role above `level`, for the card's `next role` line. */
export const nextRole = (guild, level) => ladder(guild).find((entry) => entry.level > level) ?? null;

export function watch(client) {
  client.on(Events.MessageCreate, (message) => {
    if (!message.guild || message.author?.bot) return;

    try {
      bumpMessage(message.guildId, message.author.id);

      const result = award(message.guildId, message.author.id);
      if (!result || result.after <= result.before) return;

      const role = message.guild.roles.cache.find(
        (candidate) => new RegExp(`^lvl\\s*${result.after}$`, 'i').test(candidate.name),
      );

      if (role) message.member?.roles.add(role, `level ${result.after}`).catch(() => {});
    } catch (error) {
      console.warn('[slink] level skipped —', error?.message ?? error);
    }
  });
}
