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
import { glyphs, palette } from './theme.js';

/**
 * join to create.
 *
 * one command builds the whole area: a `vc` category, a text channel people can
 * read, and the voice channel that spawns rooms. a member joins the hub and gets
 * a channel of their own with a panel only they can press; the room lives while
 * somebody is in it, so a server never fills with dead rooms.
 */

const key = 'voicemaster';
const ceiling = 300;

/** channelId → { ownerId, guildId }. memory only: a restart just orphans rooms. */
const owned = new Map();

export const settings = (guildId) => cached(guildId, key) ?? { hubId: null, categoryId: null, textId: null };

export function save(guildId, patch) {
  const next = { ...settings(guildId), ...patch };
  set(guildId, key, next);

  return next;
}

const panel = (state) => {
  const box = shell(palette.panel);
  heading(box, { title: 'your channel', note: state.ownerId ? `owner <@${state.ownerId}>` : 'owner' });
  box.addSeparatorComponents(rule());
  box.addTextDisplayComponents(text(`${state.locked ? 'locked' : 'open'}  ·  ${state.hidden ? 'hidden' : 'visible'}`));
  box.addTextDisplayComponents(quiet('only you can use these'));
  box.addActionRowComponents(new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('vm:lock').setLabel(state.locked ? 'unlock' : 'lock').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('vm:hide').setLabel(state.hidden ? 'show' : 'hide').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('vm:rename').setLabel('rename').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('vm:kick').setLabel('kick').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('vm:delete').setEmoji(glyphs.trash).setStyle(ButtonStyle.Secondary),
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

/** build the category, the text channel and the hub, or say why not. */
export async function provision(guild, name = 'vc') {
  const me = guild.members.me;
  if (!me?.permissions.has(PermissionFlagsBits.ManageChannels)) {
    return { problem: 'i need **manage channels** to build the area.' };
  }

  const category = await guild.channels.create({
    name,
    type: ChannelType.GuildCategory,
    reason: 'voicemaster setup',
  }).catch(() => null);

  if (!category) return { problem: 'discord refused the category.' };

  const text = await guild.channels.create({
    name: 'vc',
    type: ChannelType.GuildText,
    parent: category.id,
    topic: 'join the voice channel below to get a room of your own.',
    reason: 'voicemaster setup',
  }).catch(() => null);

  const hub = await guild.channels.create({
    name: 'join to create',
    type: ChannelType.GuildVoice,
    parent: category.id,
    reason: 'voicemaster setup',
  }).catch(() => null);

  if (!hub) {
    await text?.delete().catch(() => {});
    await category.delete().catch(() => {});

    return { problem: 'discord refused the voice channel.' };
  }

  save(guild.id, { categoryId: category.id, textId: text?.id ?? null, hubId: hub.id });

  return { category, text, hub };
}

/** take the built area down; nothing a person made by hand is touched. */
export async function dismantle(guild) {
  const state = settings(guild.id);
  const gone = [];

  for (const id of [state.textId, state.hubId, state.categoryId]) {
    if (!id) continue;

    const channel = guild.channels.cache.get(id) ?? await guild.channels.fetch(id).catch(() => null);
    if (!channel) continue;

    await channel.delete('voicemaster off').catch(() => {});
    gone.push(id);
  }

  save(guild.id, { categoryId: null, textId: null, hubId: null });

  return gone.length;
}

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
    reason: 'voicemaster room',
  }).catch((error) => error);

  if (channel instanceof Error) {
    console.warn('[slink] voicemaster — could not create the room:', channel.message);
    return null;
  }

  if (owned.size >= ceiling) owned.delete(owned.keys().next().value);
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
  owned.delete(channelId);

  const channel = guild.channels.cache.get(channelId);
  if (channel) await channel.delete('voicemaster — empty').catch(() => {});
}

export function watch(client) {
  client.on(Events.ChannelDelete, (channel) => {
    owned.delete(channel.id);
  });

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
    const ownerId = record?.ownerId ?? null;

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
      console.warn('[slink] voicemaster —', error?.message ?? error);
      await interaction
        .reply({ content: `${emoji.cross} that did not work.`, flags: MessageFlags.Ephemeral })
        .catch(() => {});
    }
  });
}
