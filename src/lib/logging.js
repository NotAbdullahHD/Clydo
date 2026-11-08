import { Events } from 'discord.js';
import { facts, heading, payload, rule, shell } from './card.js';
import { cached } from './config.js';

/**
 * server logs.
 *
 * the four things staff actually need a record of: messages that vanished,
 * members arriving and leaving, channels and roles appearing or changing. every
 * entry is the same card — title, who and where in the note, the detail as facts.
 */

const key = 'logging';

export const blank = () => ({
  channelId: null,
  messages: true,
  members: true,
  channels: true,
  roles: true,
});

export const kinds = ['messages', 'members', 'channels', 'roles'];

export function settings(guildId) {
  return { ...blank(), ...(cached(guildId, key) ?? {}) };
}

const cut = (value, size = 280) => {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (!text) return '—';
  return text.length > size ? `${text.slice(0, size - 1)}…` : text;
};

const at = () => `<t:${Math.floor(Date.now() / 1000)}:t>`;

async function write(guild, title, rows, note = at()) {
  const state = settings(guild.id);
  if (!state.channelId) return;

  const channel = guild.channels.cache.get(state.channelId);
  if (!channel?.isTextBased?.()) return;

  const box = shell();
  heading(box, { title, note });
  box.addSeparatorComponents(rule());
  box.addTextDisplayComponents(facts(rows.filter(Boolean)));

  await channel.send(payload(box)).catch(() => {});
}

export function watch(client) {
  client.on(Events.MessageDelete, async (message) => {
    if (!message.guild || message.author?.bot) return;

    const state = settings(message.guild.id);
    if (!state.messages || !state.channelId || message.channelId === state.channelId) return;

    await write(message.guild, 'message deleted', [
      ['channel', `<#${message.channelId}>`],
      ['author', message.author?.username ?? 'unknown'],
      ['content', cut(message.content)],
    ]);
  });

  client.on(Events.MessageUpdate, async (_old, message) => {
    if (!message.guild || message.author?.bot) return;

    const state = settings(message.guild.id);
    if (!state.messages || !state.channelId || message.channelId === state.channelId) return;

    const before = _old?.content ?? '';
    const after = message.content ?? '';
    if (before === after) return;

    await write(message.guild, 'message edited', [
      ['channel', `<#${message.channelId}>`],
      ['author', message.author?.username ?? 'unknown'],
      ['before', cut(before)],
      ['after', cut(after)],
    ]);
  });

  client.on(Events.GuildMemberAdd, async (member) => {
    const state = settings(member.guild.id);
    if (!state.members || !state.channelId) return;

    await write(member.guild, 'member joined', [
      ['member', `${member.user.username}`],
      ['account', `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`],
      ['members', String(member.guild.memberCount)],
    ]);
  });

  client.on(Events.GuildMemberRemove, async (member) => {
    const state = settings(member.guild.id);
    if (!state.members || !state.channelId) return;

    await write(member.guild, 'member left', [
      ['member', `${member.user.username}`],
      ['joined', member.joinedTimestamp ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>` : 'unknown'],
      ['members', String(member.guild.memberCount)],
    ]);
  });

  client.on(Events.ChannelCreate, async (channel) => {
    if (!channel.guild) return;
    const state = settings(channel.guild.id);
    if (!state.channels || !state.channelId) return;

    await write(channel.guild, 'channel created', [
      ['channel', `<#${channel.id}>`],
      ['type', String(channel.type)],
    ]);
  });

  client.on(Events.ChannelDelete, async (channel) => {
    if (!channel.guild) return;
    const state = settings(channel.guild.id);
    if (!state.channels || !state.channelId) return;

    await write(channel.guild, 'channel deleted', [
      ['name', channel.name ?? channel.id],
      ['type', String(channel.type)],
    ]);
  });

  client.on(Events.GuildRoleCreate, async (role) => {
    const state = settings(role.guild.id);
    if (!state.roles || !state.channelId) return;

    await write(role.guild, 'role created', [
      ['role', role.name],
      ['id', role.id],
    ]);
  });

  client.on(Events.GuildRoleDelete, async (role) => {
    const state = settings(role.guild.id);
    if (!state.roles || !state.channelId) return;

    await write(role.guild, 'role deleted', [
      ['role', role.name],
      ['id', role.id],
    ]);
  });
}
