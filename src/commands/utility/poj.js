import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { done, oops } from '../../lib/line.js';
import { add, limits, removeChannel, settings } from '../../lib/poj.js';
import { prefix as marker } from '../../lib/prefix.js';
import { panel } from '../../lib/theme.js';

/**
 * `/poj` and `,poj` — ping on join.
 *
 * a new member is mentioned the moment they join and the line is deleted a few
 * seconds later, so the ping lands but the channel stays clean.
 */

export const name = 'poj';

const channelOption = (option) => option
  .setName('channel')
  .setDescription('the text channel')
  .setRequired(true);

export const data = new SlashCommandBuilder()
  .setName('poj')
  .setDescription('ping a new member, then delete the line')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand((sub) => sub
    .setName('add')
    .setDescription('ghost-ping joiners in a channel')
    .addChannelOption(channelOption)
    .addIntegerOption((option) => option
      .setName('delay')
      .setDescription(`seconds before the line is deleted — ${limits.fallback} by default`)
      .setMinValue(limits.min)
      .setMaxValue(limits.max)))
  .addSubcommand((sub) => sub
    .setName('remove')
    .setDescription('stop pinging joiners in a channel')
    .addChannelOption(channelOption));

function view(guildId) {
  const { channels } = settings(guildId);

  const lines = channels.length
    ? channels.map((entry) => `<#${entry.channelId}> — deletes after ${entry.delay}s`)
    : ['-# off — `/poj add #channel [delay]`'];

  return {
    embeds: [panel({
      title: 'ping on join',
      description: [
        `-# ${channels.length ? `${channels.length} channel${channels.length === 1 ? '' : 's'}` : 'off'}`,
        '',
        ...lines,
        '',
        '-# the member is mentioned, then the line goes. 1–60 seconds.',
      ].join('\n'),
    })],
  };
}

const valid = (channel) => Boolean(channel?.isTextBased?.());

export async function execute(interaction) {
  const sub = interaction.options.getSubcommand();
  const channel = interaction.options.getChannel('channel');

  if (!valid(channel)) {
    await interaction.reply(oops('pick a text channel.'));
    return;
  }

  if (sub === 'remove') {
    removeChannel(interaction.guildId, channel.id);
    await interaction.reply(done(interaction, `joiners are no longer pinged in <#${channel.id}>`));
    return;
  }

  const delay = interaction.options.getInteger('delay') ?? limits.fallback;
  add(interaction.guildId, { channelId: channel.id, delay });

  await interaction.reply(done(
    interaction,
    `joiners are pinged in <#${channel.id}>, and the line deletes after \`${delay}s\``,
  ));
}

export async function prefix(message, args) {
  if (!message.member?.permissions.has(PermissionFlagsBits.ManageGuild)) {
    await message.reply(oops('you need **manage server** for that.'));
    return;
  }

  const head = args[0]?.toLowerCase();
  const guildId = message.guild.id;
  const channel = message.mentions.channels?.first?.() ?? null;

  if (!head || !['add', 'remove'].includes(head)) {
    await message.reply(view(guildId));
    return;
  }

  if (!channel) {
    await message.reply(oops(`usage — \`${marker}poj ${head} #channel${head === 'add' ? ' [delay]' : ''}\``));
    return;
  }

  if (head === 'remove') {
    removeChannel(guildId, channel.id);
    await message.reply(done(message, `joiners are no longer pinged in <#${channel.id}>`));
    return;
  }

  const delay = args.slice(1)
    .map((value) => Number(value))
    .find((value) => Number.isFinite(value)) ?? limits.fallback;

  add(guildId, { channelId: channel.id, delay });

  await message.reply(done(
    message,
    `joiners are pinged in <#${channel.id}>, and the line deletes after \`${delay < limits.min || delay > limits.max ? limits.fallback : Math.floor(delay)}s\``,
  ));
}
