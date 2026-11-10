import { Events, PermissionFlagsBits } from 'discord.js';
import { cached, set } from './config.js';

/**
 * sticky messages.
 *
 * one message per channel that always sits at the bottom: when somebody talks,
 * the old copy leaves and a fresh one is posted behind them. the repost waits
 * for the channel to go quiet for a moment, so a burst of chatter costs one
 * message instead of one per line, and a queue per channel keeps two flushes
 * from ever crossing.
 */

const key = 'sticky';

/** how long a channel has to be quiet before the sticky moves. */
const settle = 900;

export const blank = () => ({ channels: [] });

export function settings(guildId) {
  const saved = cached(guildId, key) ?? {};

  return {
    channels: (Array.isArray(saved.channels) ? saved.channels : [])
      .filter((entry) => entry?.channelId && entry?.payload)
      .map((entry) => ({
        channelId: String(entry.channelId),
        payload: entry.payload,
        messageId: entry.messageId ? String(entry.messageId) : null,
      })),
  };
}

export const save = (guildId, change) => set(guildId, key, { ...settings(guildId), ...change });

export const find = (guildId, channelId) => settings(guildId).channels
  .find((entry) => entry.channelId === channelId) ?? null;

export function add(guildId, { channelId, payload, messageId = null }) {
  const state = settings(guildId);

  return save(guildId, {
    channels: [
      ...state.channels.filter((entry) => entry.channelId !== channelId),
      { channelId, payload, messageId },
    ],
  });
}

export function remove(guildId, channelId) {
  const state = settings(guildId);

  return save(guildId, {
    channels: state.channels.filter((entry) => entry.channelId !== channelId),
  });
}

export function remember(guildId, channelId, messageId) {
  const entry = find(guildId, channelId);
  if (!entry) return null;

  return add(guildId, { ...entry, messageId });
}

export async function channelOf(guild, channelId) {
  const channel = guild.channels.cache.get(channelId)
    ?? await guild.channels.fetch(channelId).catch(() => null);

  return channel?.isTextBased?.() ? channel : null;
}

/** post the payload in a channel, or null when it cannot be posted there. */
export async function place(guild, channelId, payload) {
  const channel = await channelOf(guild, channelId);
  if (!channel) return null;
  if (!channel.permissionsFor(guild.members.me)?.has(PermissionFlagsBits.SendMessages)) return null;

  return channel.send(payload).catch(() => null);
}

/** take the old copy down — a deleted message or a missing channel is fine. */
export async function discard(guild, entry) {
  if (!entry?.messageId) return;

  const channel = await channelOf(guild, entry.channelId);
  const message = channel ? await channel.messages.fetch(entry.messageId).catch(() => null) : null;

  await message?.delete().catch(() => {});
}

export function watch(client) {
  const pending = new Map();
  const running = new Map();

  const flush = async (guild, channelId) => {
    const entry = find(guild.id, channelId);
    if (!entry) return;

    // the old copy leaves first, so the channel never shows two of them.
    await discard(guild, entry);

    const sent = await place(guild, channelId, entry.payload);
    if (sent) remember(guild.id, channelId, sent.id);
  };

  client.on(Events.MessageCreate, (message) => {
    if (!message.guild || message.author?.bot) return;

    const entry = find(message.guildId, message.channelId);
    if (!entry) return;

    const timer = pending.get(message.channelId);
    if (timer) clearTimeout(timer);

    pending.set(message.channelId, setTimeout(() => {
      pending.delete(message.channelId);

      const chain = (running.get(message.channelId) ?? Promise.resolve())
        .then(() => flush(message.guild, message.channelId))
        .catch((error) => console.warn('[slink] sticky skipped —', error?.message ?? error))
        .finally(() => {
          if (running.get(message.channelId) === chain) running.delete(message.channelId);
        });

      running.set(message.channelId, chain);
    }, settle));
  });
}
