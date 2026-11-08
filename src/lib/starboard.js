import { Events } from 'discord.js';
import { heading, payload, picture, quiet, rule, shell, text } from './card.js';
import { cached } from './config.js';
import { sql } from './sqlite.js';

/**
 * starboard.
 *
 * when a message collects enough of one emoji, it is copied into the starboard
 * channel once. the copy links back, keeps the face and the words, and leaves
 * again if the reactions fall below the threshold.
 */

const key = 'starboard';

export const blank = () => ({ channelId: null, threshold: 3, emoji: '⭐' });

export function settings(guildId) {
  return { ...blank(), ...(cached(guildId, key) ?? {}) };
}

/** the board message already posted for one message, if any. */
export function posted(guildId, messageId) {
  return sql()
    .prepare('SELECT board_id FROM starboards WHERE guild_id = ? AND message_id = ?')
    .get(guildId, messageId)?.board_id ?? null;
}

export function remember(guildId, messageId, boardId) {
  sql()
    .prepare(`
      INSERT INTO starboards (guild_id, message_id, board_id) VALUES (?, ?, ?)
      ON CONFLICT (guild_id, message_id) DO UPDATE SET board_id = excluded.board_id
    `)
    .run(guildId, messageId, boardId);
}

export function forget(guildId, messageId) {
  const boardId = posted(guildId, messageId);

  sql()
    .prepare('DELETE FROM starboards WHERE guild_id = ? AND message_id = ?')
    .run(guildId, messageId);

  return boardId;
}

const countOf = (message, emoji) => {
  const entry = [...message.reactions.cache.values()].find(
    (reaction) => (reaction.emoji.id ?? reaction.emoji.name) === emoji || reaction.emoji.name === emoji,
  );

  return entry?.count ?? 0;
};

const cut = (value, size = 600) => {
  const body = String(value ?? '').trim();
  return body.length > size ? `${body.slice(0, size - 1)}…` : body;
};

function card(message, emoji, count) {
  const box = shell();
  heading(box, {
    title: 'starboard',
    note: `${message.author?.username ?? 'someone'} · #${message.channel?.name ?? 'channel'} · ${count} ${emoji}`,
  });
  box.addSeparatorComponents(rule());

  box.addTextDisplayComponents(text(cut(message.content) || 'no text — just the attachment.'));

  const image = message.attachments?.find?.((file) => file.contentType?.startsWith('image/'));
  if (image) picture(box, image.url);

  box.addTextDisplayComponents(quiet(`[jump to the message](${message.url})`));

  return payload(box);
}

export function watch(client) {
  const resolveBoard = async (message, state) => message.guild?.channels.cache.get(state.channelId)
    ?? message.guild?.channels.fetch(state.channelId).catch(() => null);

  client.on(Events.MessageReactionAdd, async (reaction) => {
    try {
      if (reaction.partial) await reaction.fetch().catch(() => null);

      const message = reaction.message;
      if (!message?.guildId || message.author?.bot) return;

      const state = settings(message.guildId);
      if (!state.channelId) return;
      if (message.channelId === state.channelId) return;

      const count = countOf(message, state.emoji);
      if (count < state.threshold) return;
      if (posted(message.guildId, message.id)) return;

      const channel = await resolveBoard(message, state);
      if (!channel?.isTextBased?.()) return;

      const sent = await channel.send({ ...card(message, state.emoji, count), allowedMentions: { parse: [] } });
      remember(message.guildId, message.id, sent.id);
    } catch (error) {
      console.warn('[slink] starboard skipped —', error?.message ?? error);
    }
  });

  client.on(Events.MessageReactionRemove, async (reaction) => {
    try {
      if (reaction.partial) await reaction.fetch().catch(() => null);

      const message = reaction.message;
      if (!message?.guildId) return;

      const state = settings(message.guildId);
      const boardId = posted(message.guildId, message.id);
      if (!boardId) return;

      const count = countOf(message, state.emoji);
      if (count >= state.threshold) return;

      forget(message.guildId, message.id);

      const channel = await resolveBoard(message, state);
      const board = channel?.messages
        ? await channel.messages.fetch(boardId).catch(() => null)
        : null;

      await board?.delete().catch(() => {});
    } catch (error) {
      console.warn('[slink] starboard removal skipped —', error?.message ?? error);
    }
  });
}
