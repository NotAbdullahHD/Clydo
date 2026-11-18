import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  Events,
  MessageFlags,
  PermissionFlagsBits,
} from 'discord.js';
import { cached, set } from './config.js';
import { heading, payload, quiet, rule, shell, text, V2 } from './card.js';
import { emoji } from './emoji.js';
import { palette } from './theme.js';

/**
 * join to create.
 *
 * a member joins the hub and gets a channel of their own, plus a panel inside it
 * that only they can press. the channel lives exactly as long as somebody is in
 * it, so a server never fills up with dead rooms.
 */

const key = 'voicemaster';

/** channelId → { ownerId, guildId }. memory only: a restart just orphans rooms. */
const owned = new Map();

export const settings = (guildId) => cached(guildId, key) ?? { hubId: null, categoryId: null, limit: 0 };

export function save(guildId, patch) {
  const next = { ...settings(guildId), ...patch };
  set(guildId, key, next);

  return next;
}

const panel = (state) => {
  const box = shell(palette.accent);
  heading(box, { title: 'your channel', note: state.ownerId ? `owner <@${state.ownerId}>` : 'owner' });
  box.addSeparatorComponents(rule());
  box.addTextDisplayComponents(text([
    `${state.locked ? 'locked' : 'open'}  ·  ${state.hidden ? 'hidden' : 'visible'}`,
  ].join('\n')));
  box.addTextDisplayComponents(quiet('only you can use these'));
  box.addActionRowComponents(new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('vm:lock')
      .setLabel(state.locked ? 'unlock' : 'lock')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('vm:hide')
      .setLabel(state.hidden ? 'show' : 'hide')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('vm:rename').setLabel('rename').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('vm:kick').setLabel('kick').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('vm:delete').setEmoji('🗑').setStyle(ButtonStyle.Secondary),
  ));

  return payload(box);
};

const stateOf = (channel, ownerId) => {
  const overwrite = channel.permissionOverwrites.cache.get(channel.guild.id);

  return {
    ownerId,
    locked: overwrite?.deny?.has(PermissionFlagsBits.Connect) ?? false,
    hidden: overwrite?.deny?.has(PermissionFlagsBits.ViewChannel) ?? false,
  };
};

async function build(member, hub) {
  const guild = member.guild;
  const name = member.displayName?.slice(0, 90) || 'voice';

  const channel = await guild.channels.create({
    name,
    type: ChannelType.GuildVoice,
    parent: hub.parentId ?? settings(guild.id).categoryId ?? null,
    permissionOverwrites: [
      {
        id: member.id,
        allow: [PermissionFlagsBits.ManageChannels, PermissionFlagsBits.MoveMembers],
      },
      {
        id: guild.id,
        allow: [PermissionFlagsBits.Connect, PermissionFlagsBits.ViewChannel],
      },
    ],
  }).catch(() => null);

  if (!channel) return null;

  owned.set(channel.id, { ownerId: member.id, guildId: guild.id });
  await member.voice.setChannel(channel).catch(() => {});

  const note = await channel.send({
    ...panel(stateOf(channel, member.id)),
    flags: V2 | MessageFlags.SuppressNotifications,
  }).catch(() => null);
  if (note) owned.set(channel.id, { ownerId: member.id, guildId: guild.id, panelId: note.id });

  return channel;
}

const live = (channel) => channel.members.some((member) => !member.user.bot);

async function close(channelId, guild) {
  const channel = guild.channels.cache.get(channelId);
  owned.delete(channelId);

  if (channel) await channel.delete('voicemaster — empty').catch(() => {});
}

export function watch(client) {
  client.on(Events.VoiceStateUpdate, async (before, after) => {
    const guild = after.guild ?? before.guild;
    if (!guild) return;

    const hub = settings(guild.id).hubId;

    if (hub && after.channelId === hub && !after.member?.user.bot) {
      const channel = await build(after.member, guild.channels.cache.get(hub));
      if (!channel) {
        await after.member.voice.disconnect().catch(() => {});
      }
      return;
    }

    if (before.channelId && owned.has(before.channelId)) {
      const channel = guild.channels.cache.get(before.channelId);
      if (channel && !live(channel)) await close(channel.id, guild);
    }
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isButton() || !interaction.customId.startsWith('vm:')) return;

    const channel = interaction.channel;
    const record = owned.get(channel?.id);
    const ownerId = record?.ownerId ?? interaction.member?.id;

    if (!channel || !channel.isVoiceBased?.()) return;
    if (interaction.user.id !== ownerId) {
      await interaction.reply({ content: `${emoji.cross} this channel is not yours.`, flags: MessageFlags.Ephemeral });
      return;
    }

    const action = interaction.customId.slice(3);

    try {
      if (action === 'delete') {
        await interaction.reply({ content: `${emoji.check} closing.`, flags: MessageFlags.Ephemeral });
        await close(channel.id, channel.guild);
        return;
      }

      if (action === 'rename') {
        await interaction.reply({ content: `${emoji.check} send a new name in this chat.`, flags: MessageFlags.Ephemeral });
        const asked = await channel.awaitMessages({
          filter: (message) => message.author.id === interaction.user.id,
          max: 1,
          time: 30_000,
        }).catch(() => null);

        const name = asked?.first()?.content?.trim();
        if (name) await channel.setName(name.slice(0, 90)).catch(() => {});
        return;
      }

      if (action === 'kick') {
        const targets = channel.members.filter((member) => member.id !== interaction.user.id && !member.user.bot);
        if (!targets.size) {
          await interaction.reply({ content: `${emoji.cross} nobody else is here.`, flags: MessageFlags.Ephemeral });
          return;
        }

        const first = targets.first();
        await first.voice.disconnect().catch(() => {});
        await interaction.reply({ content: `${emoji.check} removed <@${first.id}>.`, flags: MessageFlags.Ephemeral });
        return;
      }

      const everyone = channel.guild.roles.everyone;
      if (action === 'lock') {
        const locked = stateOf(channel, ownerId).locked;
        await channel.permissionOverwrites.edit(everyone, {
          [PermissionFlagsBits.Connect]: locked ? null : false,
        });
      }

      if (action === 'hide') {
        const hidden = stateOf(channel, ownerId).hidden;
        await channel.permissionOverwrites.edit(everyone, {
          [PermissionFlagsBits.ViewChannel]: hidden ? null : false,
        });
      }

      await interaction.update(panel(stateOf(channel, ownerId)));
    } catch (error) {
      await interaction.reply({ content: `${emoji.cross} that did not work — ${error.message}`, flags: MessageFlags.Ephemeral }).catch(() => {});
    }
  });
}
