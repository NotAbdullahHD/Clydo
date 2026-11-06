import { Collection, Events } from 'discord.js';

/**
 * snipes — the last deleted message per channel, held in memory only.
 *
 * content is only readable when the privileged message content intent is on;
 * without it a snipe still records who and when, with no text.
 */

export const snipes = new Collection();

const limit = 500;
const maxText = 900;

const capture = (message) => ({
  author: message.author.username,
  id: message.author.id,
  text: message.content?.trim() || '',
  attachment: message.attachments?.first?.()?.url ?? null,
  at: message.createdTimestamp ?? Date.now(),
});

export function watch(client) {
  client.on(Events.MessageDelete, (message) => {
    if (!message.guild || !message.author || message.author.bot) return;

    snipes.set(message.channelId, capture(message));

    if (snipes.size > limit) {
      snipes.delete(snipes.firstKey());
    }
  });
}

/** the record for a channel, trimmed to something an embed can hold. */
export function peek(channelId) {
  const record = snipes.get(channelId);
  if (!record) return null;

  return {
    ...record,
    text: record.text.length > maxText ? `${record.text.slice(0, maxText - 1)}…` : record.text,
  };
}
