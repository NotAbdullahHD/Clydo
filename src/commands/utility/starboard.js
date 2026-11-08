import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { done, oops } from '../../lib/line.js';
import { norm, save, settings, toggleIgnore } from '../../lib/starboard.js';
import { panel } from '../../lib/theme.js';

/**
 * `/starboard` and `,starboard` — the message hall of fame.
 */

export const name = 'starboard';
export const names = ['star'];

const channelOption = (option) => option
  .setName('channel')
  .setDescription('the starboard channel')
  .setRequired(true);

export const data = new SlashCommandBuilder()
  .setName('starboard')
  .setDescription('the message hall of fame')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand((sub) => sub.setName('config').setDescription('show what the starboard is doing'))
  .addSubcommand((sub) => sub
    .setName('set')
    .setDescription('choose the starboard channel')
    .addChannelOption(channelOption))
  .addSubcommand((sub) => sub
    .setName('ignore')
    .setDescription('stop counting a channel, a role or a member')
    .addChannelOption((option) => option.setName('channel').setDescription('a channel that never counts'))
    .addMentionableOption((option) => option
      .setName('member_or_role')
      .setDescription('a role or a member that never counts')))
  .addSubcommand((sub) => sub
    .setName('threshold')
    .setDescription('how many reactions a message needs')
    .addIntegerOption((option) => option
      .setName('threshold')
      .setDescription('1 to 25')
      .setMinValue(1)
      .setMaxValue(25)
      .setRequired(true)))
  .addSubcommand((sub) => sub
    .setName('emoji')
    .setDescription('which reaction counts')
    .addStringOption((option) => option
      .setName('emoji')
      .setDescription('any emoji — ⭐ by default')
      .setRequired(true)))
  .addSubcommand((sub) => sub.setName('off').setDescription('stop posting'));

function view(guildId) {
  const state = settings(guildId);
  const { channels, roles, members } = state.ignore;
  const muted = channels.length + roles.length + members.length;

  const options = [
    state.options.attachments ? 'attachments' : null,
    state.options.timestamp ? 'timestamp' : null,
    state.options.jump ? 'jump link' : null,
    state.options.selfStar ? 'self-stars count' : null,
  ].filter(Boolean);

  return {
    embeds: [panel({
      title: 'starboard',
      description: [
        `-# ${state.channelId ? 'on' : 'off'}`,
        '',
        `**channel** — ${state.channelId ? `<#${state.channelId}>` : 'not set'}`,
        `**emoji** — ${state.emoji}`,
        `**threshold** — ${state.threshold}`,
        `**ignoring** — ${muted
          ? `${channels.length} channel${channels.length === 1 ? '' : 's'}, ${roles.length} role${roles.length === 1 ? '' : 's'}, ${members.length} member${members.length === 1 ? '' : 's'}`
          : 'nothing'}`,
        `**shows** — ${options.length ? options.join(' · ') : 'plain copies'}`,
        '',
        '-# `/starboard set` · `/starboard threshold` · `/starboard emoji` · `/starboard ignore`',
      ].join('\n'),
    })],
  };
}

const emojiValue = (raw) => {
  const custom = String(raw).match(/^<a?:\w+:(\d+)>$/)?.[1];
  return custom ?? norm(raw);
};

export async function execute(interaction) {
  const sub = interaction.options.getSubcommand();
  const guildId = interaction.guildId;

  if (sub === 'config') {
    await interaction.reply(view(guildId));
    return;
  }

  if (sub === 'off') {
    save(guildId, { channelId: null });
    await interaction.reply(done(interaction, 'starboard is off.'));
    return;
  }

  if (sub === 'set') {
    const channel = interaction.options.getChannel('channel');
    if (!channel?.isTextBased?.()) {
      await interaction.reply(oops('pick a text channel.'));
      return;
    }

    save(guildId, { channelId: channel.id });
    await interaction.reply(done(interaction, `starboard **channel** has been set to <#${channel.id}>`));
    return;
  }

  if (sub === 'threshold') {
    const value = interaction.options.getInteger('threshold');
    save(guildId, { threshold: value });
    await interaction.reply(done(interaction, `starboard **threshold** has been set to \`${value}\``));
    return;
  }

  if (sub === 'emoji') {
    const value = emojiValue(interaction.options.getString('emoji'));
    save(guildId, { emoji: value });
    await interaction.reply(done(interaction, `starboard **reaction emoji** has been set to ${interaction.options.getString('emoji')}`));
    return;
  }

  const channel = interaction.options.getChannel('channel');
  const target = interaction.options.getMentionable('member_or_role');

  if (!channel && !target) {
    await interaction.reply(oops('pick a **channel**, a **role** or a **member**.'));
    return;
  }

  const isRole = Boolean(target?.color !== undefined);
  const result = toggleIgnore(guildId, {
    channelId: channel?.id ?? null,
    roleId: isRole ? target.id : null,
    memberId: target && !isRole ? target.id : null,
  });

  await interaction.reply(done(
    interaction,
    `now ${result.on ? 'listening' : 'no longer listening'} for **reactions** from ${result.label}`,
  ));
}

export async function prefix(message, args) {
  if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
    await message.reply(oops('you need **manage server** for that.'));
    return;
  }

  const head = args[0]?.toLowerCase();
  const guildId = message.guild.id;
  const state = settings(guildId);
  const channel = message.mentions.channels?.first?.() ?? null;
  const role = message.mentions.roles?.first?.() ?? null;
  const member = message.mentions.members?.first?.() ?? null;

  if (!head) {
    await message.reply(view(guildId));
    return;
  }

  if (head === 'off') {
    save(guildId, { channelId: null });
    await message.reply(done(message, 'starboard is off.'));
    return;
  }

  if (head === 'set' || (channel && head !== 'ignore')) {
    const target = channel ?? null;
    if (!target) {
      await message.reply(oops('usage — `,starboard set #channel`'));
      return;
    }

    save(guildId, { channelId: target.id });
    await message.reply(done(message, `starboard **channel** has been set to <#${target.id}>`));
    return;
  }

  if (head === 'threshold') {
    const value = Number(args[1]);

    if (!Number.isInteger(value) || value < 1 || value > 25) {
      await message.reply(oops('threshold is a whole number from **1** to **25**.'));
      return;
    }

    save(guildId, { threshold: value });
    await message.reply(done(message, `starboard **threshold** has been set to \`${value}\``));
    return;
  }

  if (head === 'emoji') {
    const raw = args.slice(1).join(' ').trim();

    if (!raw) {
      await message.reply(oops('usage — `,starboard emoji ⭐`'));
      return;
    }

    save(guildId, { emoji: emojiValue(raw) });
    await message.reply(done(message, `starboard **reaction emoji** has been set to ${raw}`));
    return;
  }

  if (head === 'ignore' || head === 'toggle') {
    if (!channel && !role && !member) {
      await message.reply(oops('mention a **channel**, a **role** or a **member**.'));
      return;
    }

    const result = toggleIgnore(guildId, {
      channelId: channel?.id ?? null,
      roleId: role?.id ?? null,
      memberId: member?.id ?? null,
    });

    await message.reply(done(
      message,
      `now ${result.on ? 'listening' : 'no longer listening'} for **reactions** from ${result.label}`,
    ));
    return;
  }

  await message.reply(view(guildId));
}
