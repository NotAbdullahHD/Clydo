import { Events } from 'discord.js';

/**
 * snipes — a short history per channel, in memory only.
 *
 * one entry per channel was the old shape; nobody deletes one message. three
 * lists now: deleted, edited, and reactions that were taken back, twenty deep
 * each. content needs the privileged message content intent — without it a
 * record still keeps who and when, just no text.
 */

export const depth = 20;

const channels = 500;
const maxText = 900;

/** channelId → { delete: [], edit: [], reaction: [] }, newest first. */
const store = new Map();

const list = (channelId, kind) => {
  if (!store.has(channelId)) store.set(channelId, { delete: [], edit: [], reaction: [] });

  return store.get(channelId)[kind];
};

const clip = (value) => {
  const text = String(value ?? '').trim();
  return text.length > maxText ? `${text.slice(0, maxText - 1)}…` : text;
};

function remember(channelId, kind, entry) {
  if (!store.has(channelId) && store.size >= channels) {
    store.delete(store.keys().next().value);
  }

  const entries = list(channelId, kind);
  entries.unshift(entry);

  return entries.slice(0, depth);
}

export const kinds = Object.freeze({
  delete: { command: 'snipe', short: 's', title: 'snipe' },
  edit: { command: 'editsnipe', short: 'es', title: 'editsnipe' },
  reaction: { command: 'reactionsnipe', short: 'rs', title: 'reactionsnipe' },
});

export function watch(client) {
  client.on(Events.MessageDelete, (message) => {
    if (!message.guild || !message.author || message.author.bot) return;

    remember(message.channelId, 'delete', {
      author: message.author.username,
      id: message.author.id,
      text: clip(message.content),
      attachment: message.attachments?.first?.()?.url ?? null,
      at: message.createdTimestamp ?? Date.now(),
    });
  });

  client.on(Events.MessageUpdate, (before, after) => {
    if (!after.guild || !after.author || after.author.bot) return;

    const from = clip(before?.content);
    const to = clip(after.content);
    if (!from || from === to) return;

    remember(after.channelId, 'edit', {
      author: after.author.username,
      id: after.author.id,
      before: from,
      after: to,
      at: Date.now(),
    });
  });

  client.on(Events.MessageReactionRemove, async (reaction, user) => {
    if (reaction.partial) await reaction.fetch().catch(() => null);
    if (!reaction.message?.guildId || !user || user.bot) return;

    remember(reaction.message.channelId, 'reaction', {
      author: reaction.message.author?.username ?? 'unknown',
      id: reaction.message.author?.id ?? '0',
      emoji: reaction.emoji?.id
        ? `<:${reaction.emoji.name}:${reaction.emoji.id}>`
        : String(reaction.emoji?.name ?? '?'),
      by: user.username,
      byId: user.id,
      messageId: reaction.message.id,
      at: Date.now(),
    });
  });
}

/** one entry, or null when that list is empty. */
export const peek = (channelId, kind = 'delete', index = 0) => store.get(channelId)?.[kind]?.[index] ?? null;

export const count = (channelId, kind = 'delete') => store.get(channelId)?.[kind]?.length ?? 0;

export const all = (channelId, kind = 'delete') => store.get(channelId)?.[kind] ?? [];
