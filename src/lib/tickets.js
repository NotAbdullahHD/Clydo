import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  Events,
  MessageFlags,
  PermissionFlagsBits,
} from 'discord.js';
import { heading, payload, quiet, rule, shell, simple, text } from './card.js';
import { cached } from './config.js';
import { palette } from './theme.js';

/**
 * tickets, lite.
 *
 * one panel in one channel. the button opens a private thread the member and the
 * staff can see, with a close button inside it — no categories, no transcripts,
 * no second panel to keep in sync.
 */

const key = 'tickets';

export const blank = () => ({ channelId: null, panelId: null });

export function settings(guildId) {
  return { ...blank(), ...(cached(guildId, key) ?? {}) };
}

export function panel() {
  const box = shell();
  heading(box, { title: 'support', note: 'one ticket at a time · private thread' });
  box.addSeparatorComponents(rule());
  box.addTextDisplayComponents(text('press the button and a private thread opens here. only you and the staff can read it.'));
  box.addActionRowComponents(new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticket:open').setLabel('open a ticket').setStyle(ButtonStyle.Primary),
  ));

  return payload(box);
}

function threadCard(user) {
  const box = shell();
  heading(box, { title: 'ticket', note: `${user.username} · opened just now` });
  box.addSeparatorComponents(rule());
  box.addTextDisplayComponents(text('describe the problem in here and someone will answer. press close when it is done.'));
  box.addActionRowComponents(new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticket:close').setLabel('close').setStyle(ButtonStyle.Danger),
  ));

  return payload(box);
}

async function open(interaction, state) {
  const channel = interaction.guild.channels.cache.get(state.channelId)
    ?? await interaction.guild.channels.fetch(state.channelId).catch(() => null);

  if (!channel) {
    await interaction.reply({
      ...simple({ accent: palette.bad, message: 'the ticket channel is gone — run `,ticket setup` again.' }),
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const name = `ticket-${interaction.user.username}`.slice(0, 90);

  const thread = await channel.threads.create({
    name,
    type: ChannelType.PrivateThread,
    invitable: false,
    reason: `ticket opened by ${interaction.user.tag}`,
  });

  await thread.members.add(interaction.user.id).catch(() => {});
  await thread.send({ ...threadCard(interaction.user), allowedMentions: { parse: [] } });

  await interaction.reply({
    ...simple({ accent: palette.good, message: `your ticket is open — <#${thread.id}>` }),
    flags: MessageFlags.Ephemeral,
  });
}

async function close(interaction) {
  const channel = interaction.channel;
  const thread = channel?.isThread?.() ? channel : null;

  if (!thread) {
    await interaction.reply({
      ...simple({ accent: palette.bad, message: 'this is not a ticket thread.' }),
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const owner = thread.ownerId === interaction.user.id;
  const staff = interaction.member?.permissions.has(PermissionFlagsBits.ManageThreads);

  if (!owner && !staff) {
    await interaction.reply({
      ...simple({ accent: palette.bad, message: 'only the person who opened it or staff can close it.' }),
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.reply({
    ...simple({ accent: palette.panel, message: `closed by ${interaction.user.username}.` }),
    allowedMentions: { parse: [] },
  });

  await thread.setLocked(true).catch(() => {});
  await thread.setArchived(true).catch(() => {});
}

/** the only global button listener in the bot; everything else is per-message. */
export function watch(client) {
  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isButton?.() || !interaction.guildId) return;
    if (!['ticket:open', 'ticket:close'].includes(interaction.customId)) return;

    try {
      if (interaction.customId === 'ticket:close') {
        await close(interaction);
        return;
      }

      const state = settings(interaction.guildId);
      if (!state.channelId) {
        await interaction.reply({
          ...simple({ accent: palette.bad, message: 'tickets are not set up in this server.' }),
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      await open(interaction, state);
    } catch (error) {
      console.warn('[slink] ticket skipped —', error?.message ?? error);

      await interaction
        .followUp({
          ...simple({ accent: palette.bad, message: 'that one broke — try again in a moment.' }),
          flags: MessageFlags.Ephemeral,
        })
        .catch(() => {});
    }
  });
}
