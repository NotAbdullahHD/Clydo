import { Events, MediaGalleryBuilder, SectionBuilder, ThumbnailBuilder } from 'discord.js';
import { payload, quiet, rule, shell, text } from './card.js';
import { cached, set } from './config.js';
import { sql } from './sqlite.js';

/**
 * starboard.
 *
 * a message that collects enough of one emoji is copied into the starboard
 * channel once: the count, the face, the words, the attachment, and the way
 * back. channels, roles and members can be told to never count, and the copy
 * leaves again when the reactions fall below the threshold.
 */

const key = 'starboard';

export const blank = () => ({
  channelId: null,
  threshold: 3,
  emoji: '⭐',
  ignore: { channels: [], roles: [], members: [] },
  options: { attachments: true, timestamp: true, jump: true, selfStar: false },
});

export function settings(guildId) {
  const saved = cached(guildId, key) ?? {};
  const base = blank();

  return {
    ...base,
    ...saved,
    ignore: { ...base.ignore, ...(saved.ignore ?? {}) },
    options: { ...base.options, ...(saved.options ?? {}) },
  };
}

export const save = (guildId, change) => set(guildId, key, { ...settings(guildId), ...change });

/** `⭐` and `⭐️` are the same emoji; discord sends both. */
export const norm = (value) => String(value ?? '').replace(/\uFE0F/g, '');

/** a unicode name, a custom id, or a stored string all compare here. */
export function matches(emoji, wanted) {
  if (!emoji || !wanted) return false;
  if (emoji.id && emoji.id === wanted) return true;

  return norm(emoji.name ?? emoji) === norm(wanted);
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

/** flip one channel, role or member in the ignore list. */
export function toggleIgnore(guildId, { channelId = null, roleId = null, memberId = null }) {
  const state = settings(guildId);
  const list = channelId ? 'channels' : roleId ? 'roles' : 'members';
  const id = channelId ?? roleId ?? memberId;
  if (!id) return null;

  const has = state.ignore[list].includes(id);
  const next = has
    ? state.ignore[list].filter((value) => value !== id)
    : [...state.ignore[list], id];

  save(guildId, { ignore: { ...state.ignore, [list]: next } });

  return {
    on: !has,
    label: channelId ? `<#${id}>` : roleId ? `<@&${id}>` : labelOfMember(id),
    list,
  };
}

const labelOfMember = (id) => `<@${id}>`;

const ignored = (message, state) => {
  const lists = state.ignore;

  if (lists.channels.includes(message.channelId)) return true;
  if (message.channel?.parentId && lists.channels.includes(message.channel.parentId)) return true;
  if (lists.members.includes(message.author?.id)) return true;
  if (lists.roles.length && message.member?.roles?.cache?.some((role) => lists.roles.includes(role.id))) {
    return true;
  }

  return false;
};

const countOf = (message, wanted, allowSelf) => {
  const entry = [...message.reactions.cache.values()].find((reaction) => matches(reaction.emoji, wanted));
  if (!entry) return 0;

  let count = entry.count ?? 0;
  if (!allowSelf && message.author?.id && entry.users?.cache?.has(message.author.id)) count -= 1;

  return Math.max(0, count);
};

const cut = (value, size = 900) => {
  const body = String(value ?? '').trim();
  return body.length > size ? `${body.slice(0, size - 1)}…` : body;
};

const stamp = (ms) => `<t:${Math.floor(ms / 1000)}:f>`;

/** images and video load in the card; everything else is a link with its name. */
function media(message, state) {
  const files = [...(message.attachments?.values?.() ?? [])];
  if (!files.length) return { gallery: [], links: [] };

  if (!state.options.attachments) {
    return { gallery: [], links: files.slice(0, 5).map((file) => `[${file.name}](${file.url})`) };
  }

  const gallery = files
    .filter((file) => /^(image|video)\//.test(file.contentType ?? ''))
    .slice(0, 4)
    .map((file) => ({ media: { url: file.url } }));

  const links = files
    .filter((file) => !/^(image|video)\//.test(file.contentType ?? ''))
    .slice(0, 5)
    .map((file) => `[${file.name}](${file.url})`);

  return { gallery, links };
}

export function card(message, state, count) {
  const box = shell();
  const author = message.author;

  box.addTextDisplayComponents(text(`${state.emoji} **${count}**`));
  box.addSeparatorComponents(rule());

  const face = author?.displayAvatarURL?.({ size: 128 });

  if (face) {
    box.addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(text(`**${author.username}**`))
        .setThumbnailAccessory(new ThumbnailBuilder().setURL(face)),
    );
  } else {
    box.addTextDisplayComponents(text(`**${author?.username ?? 'someone'}**`));
  }

  const body = cut(message.content);
  if (body) box.addTextDisplayComponents(text(body));

  const { gallery, links } = media(message, state);
  if (gallery.length) box.addMediaGalleryComponents(new MediaGalleryBuilder().addItems(...gallery));
  if (!body && links.length) box.addTextDisplayComponents(text(links.join('\n')));
  else if (links.length) box.addTextDisplayComponents(quiet(links.join(' · ')));

  box.addTextDisplayComponents(text(`<#${message.channelId}>`));
  if (state.options.jump) box.addTextDisplayComponents(text(`[jump to message](${message.url})`));
  if (state.options.timestamp) box.addTextDisplayComponents(quiet(stamp(message.createdTimestamp)));

  return payload(box);
}

export function watch(client) {
  const resolveBoard = async (guild, state) => guild.channels.cache.get(state.channelId)
    ?? guild.channels.fetch(state.channelId).catch(() => null);

  const guildOf = async (message) => message.guild
    ?? (message.guildId ? message.client.guilds.fetch(message.guildId).catch(() => null) : null);

  client.on(Events.MessageReactionAdd, async (reaction, user) => {
    try {
      if (reaction.partial) await reaction.fetch().catch(() => null);

      const message = reaction.message;
      if (!message?.guildId || message.author?.bot) return;
      if (user?.bot) return;

      const state = settings(message.guildId);
      if (!state.channelId) return;
      if (message.channelId === state.channelId) return;
      if (ignored(message, state)) return;

      const count = countOf(message, state.emoji, state.options.selfStar);
      if (count < state.threshold) return;
      if (posted(message.guildId, message.id)) return;

      const guild = await guildOf(message);
      if (!guild) return;

      const channel = await resolveBoard(guild, state);
      if (!channel?.isTextBased?.()) return;

      const sent = await channel.send({ ...card(message, state, count), allowedMentions: { parse: [] } });
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

      const count = countOf(message, state.emoji, true);
      if (count >= state.threshold) return;

      forget(message.guildId, message.id);

      const guild = await guildOf(message);
      const channel = guild ? await resolveBoard(guild, state) : null;
      const board = channel?.messages
        ? await channel.messages.fetch(boardId).catch(() => null)
        : null;

      await board?.delete().catch(() => {});
    } catch (error) {
      console.warn('[slink] starboard removal skipped —', error?.message ?? error);
    }
  });
}
