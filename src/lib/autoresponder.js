import { Events } from 'discord.js';
import { cached, set } from './config.js';
import { prefix } from './prefix.js';

/**
 * triggers.
 *
 * a keyword answers, or a keyword reacts, or both. matching is a case-insensitive
 * whole-word test unless the trigger is written with spaces, and `{user}`
 * becomes the person who typed it — with mentions limited to exactly them, so a
 * reply can never ping a role by accident.
 */

const key = 'autoresponders';
const limit = 30;
const cooldown = 4_000;

export const all = (guildId) => cached(guildId, key) ?? [];

const save = (guildId, rows) => set(guildId, key, rows.length ? rows : null);

export function add(guildId, plan) {
  const rows = all(guildId);

  if (rows.length >= limit) return { error: `this server already has ${limit} triggers.` };
  if (rows.some((entry) => entry.trigger === plan.trigger)) {
    return { error: 'that trigger already exists — remove it first.' };
  }

  const row = { trigger: plan.trigger, reply: plan.reply ?? null, react: plan.react ?? null };
  save(guildId, [...rows, row]);

  return { row };
}

export function remove(guildId, trigger) {
  const rows = all(guildId);
  const next = rows.filter((entry) => entry.trigger !== trigger);

  if (next.length === rows.length) return null;

  save(guildId, next);

  return rows.length - next.length;
}

const words = (text) => String(text ?? '').toLowerCase();

const hits = (content, trigger) => {
  const text = words(content);
  const needle = words(trigger);

  if (!needle) return false;
  if (!needle.includes(' ')) {
    return text.split(/[^a-z0-9_'-]+/).includes(needle);
  }

  return text.includes(needle);
};

/** at most one answer per channel every few seconds, so a busy chat stays quiet. */
const last = new Map();

export function watch(client) {
  client.on(Events.MessageCreate, async (message) => {
    if (!message.guild || message.author?.bot) return;

    const rows = all(message.guild.id);
    if (!rows.length) return;

    const content = message.content ?? '';
    if (!content || content.startsWith(prefix)) return;

    const matched = rows.filter((row) => hits(content, row.trigger));
    if (!matched.length) return;

    const id = message.channelId;
    if ((last.get(id) ?? 0) > Date.now() - cooldown) return;

    if (last.size > 1_000) {
      for (const [channel, at] of last) {
        if (at < Date.now() - cooldown * 10) last.delete(channel);
      }
    }

    last.set(id, Date.now());

    for (const row of matched) {
      if (row.react) {
        const emoji = row.react.trim();
        await message.react(emoji).catch(() => {});
      }

      if (row.reply) {
        const text = row.reply.replace(/\{user\}/gi, `<@${message.author.id}>`);
        await message.reply({ content: text, allowedMentions: { users: [message.author.id] } })
          .catch(() => {});
      }
    }
  });
}
