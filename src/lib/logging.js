import { EmbedBuilder, Events } from 'discord.js';
import { cached } from './config.js';
import { palette } from './theme.js';

/**
 * server logs.
 *
 * the events staff actually look for: a message that vanished, who edited what,
 * people arriving, nicknames and roles changing, channels and voice moving,
 * bans and timeouts. each event type has its own channel, and channels or
 * members can be told to never appear. every entry is the same card — a title,
 * the sentence, the detail in bold, then who and when underneath.
 */

const key = 'logging';

export const kinds = ['messages', 'members', 'nicknames', 'roles', 'channels', 'voice', 'moderation'];

export const blank = () => ({ routes: {}, ignore: { members: [], channels: [] } });

export function settings(guildId) {
  const saved = cached(guildId, key) ?? {};
  const routes = {};

  for (const kind of kinds) {
    if (saved.routes?.[kind]) routes[kind] = saved.routes[kind];
  }

  // the first pass kept one channel for everything with four booleans.
  if (saved.channelId) {
    for (const kind of kinds) {
      if (saved[kind] !== false) routes[kind] ??= saved.channelId;
    }
  }

  return {
    routes,
    ignore: {
      members: [...(saved.ignore?.members ?? [])],
      channels: [...(saved.ignore?.channels ?? [])],
    },
  };
}

export const routeFor = (state, kind) => state.routes[kind] ?? null;

const stamp = (ms = Date.now()) => `<t:${Math.floor(ms / 1000)}:f>`;
const ago = (ms) => `<t:${Math.floor(ms / 1000)}:R>`;

const cut = (value, size = 600) => {
  const body = String(value ?? '').replace(/\u0000/g, '').trim();
  if (!body) return '';
  return body.length > size ? `${body.slice(0, size - 1)}…` : body;
};

const channelName = (id) => (id ? `<#${id}>` : 'nowhere');

/** a channel or member on the ignore list is not written down at all. */
function muted(state, { channelId = null, memberId = null }) {
  if (channelId && state.ignore.channels.includes(channelId)) return true;
  if (memberId && state.ignore.members.includes(memberId)) return true;

  return false;
}

export function card({ title, lead, sections = [], foot = [] }) {
  const lines = [...lead];

  for (const section of sections) {
    lines.push('', `**${section.label}**`);
    if (section.value) lines.push(section.value);
  }

  const embed = new EmbedBuilder()
    .setColor(palette.panel)
    .setTitle(title)
    .setDescription(lines.join('\n'))
    .setTimestamp();

  if (foot.length) embed.setFooter({ text: foot.join(' • ') });

  return { embeds: [embed] };
}

export function watch(client) {
  async function emit(guild, kind, parts) {
    const state = settings(guild.id);
    const channelId = routeFor(state, kind);
    if (!channelId) return;

    const channel = guild.channels.cache.get(channelId)
      ?? await guild.channels.fetch(channelId).catch(() => null);

    if (!channel?.isTextBased?.()) return;

    await channel.send(card(parts)).catch(() => {});
  }

  client.on(Events.MessageDelete, async (message) => {
    const guild = message.guild;
    if (!guild || message.author?.bot) return;

    const state = settings(guild.id);
    if (!routeFor(state, 'messages')) return;
    if (muted(state, { channelId: message.channelId, memberId: message.author?.id })) return;
    if (Object.values(state.routes).includes(message.channelId)) return;

    const files = [...(message.attachments?.values?.() ?? [])];
    const body = cut(message.content) || (files.length ? files.map((file) => file.name).join(', ') : 'not readable');

    await emit(guild, 'messages', {
      title: 'message deleted',
      lead: [
        `message from <@${message.author?.id ?? '0'}> deleted in ${channelName(message.channelId)}`,
        `it was sent at \`${stamp(message.createdTimestamp)}\``,
      ],
      sections: [{ label: 'message content', value: body }],
      foot: [`user id: ${message.author?.id ?? 'unknown'}`],
    });
  });

  client.on(Events.MessageUpdate, async (before, message) => {
    const guild = message.guild;
    if (!guild || message.author?.bot) return;

    const state = settings(guild.id);
    if (!routeFor(state, 'messages')) return;
    if (muted(state, { channelId: message.channelId, memberId: message.author?.id })) return;
    if (Object.values(state.routes).includes(message.channelId)) return;

    const oldText = cut(before?.content ?? '');
    const newText = cut(message.content ?? '');
    if (oldText === newText) return;

    await emit(guild, 'messages', {
      title: 'message edited',
      lead: [
        `message from <@${message.author?.id ?? '0'}> edited \`${ago(before?.editedTimestamp ?? Date.now())}\``,
        `[view the message in ${channelName(message.channelId)}](${message.url})`,
      ],
      sections: [
        { label: 'before', value: oldText || 'not readable' },
        { label: 'after', value: newText || 'not readable' },
      ],
      foot: [`user id: ${message.author?.id ?? 'unknown'}`],
    });
  });

  client.on(Events.GuildMemberAdd, async (member) => {
    const state = settings(member.guild.id);
    if (!routeFor(state, 'members')) return;
    if (muted(state, { memberId: member.id })) return;

    await emit(member.guild, 'members', {
      title: 'member joined',
      lead: [`<@${member.id}> joined — **${member.guild.memberCount}** now.`],
      sections: [{ label: 'account', value: `created ${ago(member.user.createdTimestamp)}` }],
      foot: [`user id: ${member.id}`],
    });
  });

  client.on(Events.GuildMemberRemove, async (member) => {
    const state = settings(member.guild.id);
    if (!routeFor(state, 'members')) return;
    if (muted(state, { memberId: member.id })) return;

    await emit(member.guild, 'members', {
      title: 'member left',
      lead: [`**${member.user.username}** left — **${member.guild.memberCount}** remain.`],
      sections: [{
        label: 'was here',
        value: member.joinedTimestamp ? `joined ${ago(member.joinedTimestamp)}` : 'join date unknown',
      }],
      foot: [`user id: ${member.id}`],
    });
  });

  client.on(Events.GuildMemberUpdate, async (before, member) => {
    if (member.user?.bot) return;

    const guild = member.guild;
    const state = settings(guild.id);
    if (muted(state, { memberId: member.id })) return;

    if (routeFor(state, 'nicknames') && before.nickname !== member.nickname) {
      await emit(guild, 'nicknames', {
        title: before.nickname ? 'nickname changed' : 'nickname set',
        lead: [
          `<@${member.id}>`,
          `\`${cut(before.nickname) || before.user.username}\` → \`${cut(member.nickname) || member.user.username}\``,
        ],
        foot: [`user id: ${member.id}`],
      });
    }

    const wasMuted = before.communicationDisabledUntilTimestamp ?? null;
    const isMuted = member.communicationDisabledUntilTimestamp ?? null;

    if (routeFor(state, 'moderation') && wasMuted !== isMuted) {
      await emit(guild, 'moderation', {
        title: isMuted ? 'member timed out' : 'timeout removed',
        lead: [`<@${member.id}> ${isMuted ? `until ${stamp(isMuted)}` : 'can talk again'}`],
        foot: [`user id: ${member.id}`],
      });
    }

    if (routeFor(state, 'roles') && before.roles.cache.size !== member.roles.cache.size) {
      const added = member.roles.cache.filter((role) => !before.roles.cache.has(role.id));
      const removed = before.roles.cache.filter((role) => !member.roles.cache.has(role.id));
      if (!added.size && !removed.size) return;

      const lines = [];
      if (added.size) lines.push(`added ${[...added.values()].map((role) => `<@&${role.id}>`).join(' ')}`);
      if (removed.size) lines.push(`removed ${[...removed.values()].map((role) => `<@&${role.id}>`).join(' ')}`);

      await emit(guild, 'roles', {
        title: 'roles updated',
        lead: [`<@${member.id}>`, ...lines],
        foot: [`user id: ${member.id}`],
      });
    }
  });

  client.on(Events.ChannelCreate, async (channel) => {
    if (!channel.guild) return;
    const state = settings(channel.guild.id);
    if (!routeFor(state, 'channels') || muted(state, { channelId: channel.id })) return;

    await emit(channel.guild, 'channels', {
      title: 'channel created',
      lead: [`**${channel.name ?? channel.id}** — ${channelName(channel.id)}`],
      foot: [`channel id: ${channel.id}`],
    });
  });

  client.on(Events.ChannelDelete, async (channel) => {
    if (!channel.guild) return;
    const state = settings(channel.guild.id);
    if (!routeFor(state, 'channels') || muted(state, { channelId: channel.id })) return;

    await emit(channel.guild, 'channels', {
      title: 'channel deleted',
      lead: [`**${channel.name ?? channel.id}** is gone.`],
      foot: [`channel id: ${channel.id}`],
    });
  });

  client.on(Events.ChannelUpdate, async (before, channel) => {
    if (!channel.guild) return;
    const state = settings(channel.guild.id);
    if (!routeFor(state, 'channels') || muted(state, { channelId: channel.id })) return;

    const lines = [];
    if (before.name !== channel.name) lines.push(`\`${before.name}\` → \`${channel.name}\``);
    if ((before.topic ?? '') !== (channel.topic ?? '')) {
      lines.push(`topic — \`${cut(channel.topic) || 'cleared'}\``);
    }
    if (!lines.length) return;

    await emit(channel.guild, 'channels', {
      title: 'channel updated',
      lead: [channelName(channel.id), ...lines],
      foot: [`channel id: ${channel.id}`],
    });
  });

  client.on(Events.GuildRoleCreate, async (role) => {
    const state = settings(role.guild.id);
    if (!routeFor(state, 'roles')) return;

    await emit(role.guild, 'roles', {
      title: 'role created',
      lead: [`**${role.name}** — <@&${role.id}>`],
      foot: [`role id: ${role.id}`],
    });
  });

  client.on(Events.GuildRoleDelete, async (role) => {
    const state = settings(role.guild.id);
    if (!routeFor(state, 'roles')) return;

    await emit(role.guild, 'roles', {
      title: 'role deleted',
      lead: [`**${role.name}** is gone.`],
      foot: [`role id: ${role.id}`],
    });
  });

  client.on(Events.GuildRoleUpdate, async (before, role) => {
    const state = settings(role.guild.id);
    if (!routeFor(state, 'roles')) return;

    const lines = [];
    if (before.name !== role.name) lines.push(`name \`${before.name}\` → \`${role.name}\``);
    if (before.hexColor !== role.hexColor) lines.push(`colour ${before.hexColor} → ${role.hexColor}`);
    if (!lines.length) return;

    await emit(role.guild, 'roles', {
      title: 'role updated',
      lead: [`<@&${role.id}>`, ...lines],
      foot: [`role id: ${role.id}`],
    });
  });

  client.on(Events.VoiceStateUpdate, async (before, after) => {
    const guild = after.guild ?? before.guild;
    const member = after.member ?? before.member;
    if (!guild || !member || member.user?.bot) return;
    if (before.channelId === after.channelId) return;

    const state = settings(guild.id);
    if (!routeFor(state, 'voice') || muted(state, { memberId: member.id })) return;

    const lines = [
      `from ${channelName(before.channelId)} to ${channelName(after.channelId)}`,
    ];

    await emit(guild, 'voice', {
      title: !before.channelId ? 'joined voice' : !after.channelId ? 'left voice' : 'moved voice',
      lead: [`<@${member.id}>`, ...lines],
      foot: [`user id: ${member.id}`],
    });
  });

  client.on(Events.GuildBanAdd, async (ban) => {
    const state = settings(ban.guild.id);
    if (!routeFor(state, 'moderation') || muted(state, { memberId: ban.user.id })) return;

    await emit(ban.guild, 'moderation', {
      title: 'member banned',
      lead: [`**${ban.user.username}** was banned.`],
      sections: ban.reason ? [{ label: 'reason', value: cut(ban.reason) }] : [],
      foot: [`user id: ${ban.user.id}`],
    });
  });

  client.on(Events.GuildBanRemove, async (ban) => {
    const state = settings(ban.guild.id);
    if (!routeFor(state, 'moderation') || muted(state, { memberId: ban.user.id })) return;

    await emit(ban.guild, 'moderation', {
      title: 'ban lifted',
      lead: [`**${ban.user.username}** can come back.`],
      foot: [`user id: ${ban.user.id}`],
    });
  });
}
