import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { facts, heading, payload, quiet, rule, shell, text } from '../../lib/card.js';
import { done, oops } from '../../lib/line.js';
import { add, card, removeChannel, save, settings } from '../../lib/welcome.js';

/**
 * `/config welcome` and `,config welcome` — join and leave cards.
 *
 * a channel can carry both cards, delete them on a timer, and choose whether
 * the member is mentioned. `,welcome` still reaches the same code.
 */

export const name = 'config';
export const names = ['welcome'];

const group = 'welcome';

const channelOption = (option) => option
  .setName('channel')
  .setDescription('where the cards go')
  .setRequired(true);

export const data = new SlashCommandBuilder()
  .setName('config')
  .setDescription('server setup')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommandGroup((welcome) => welcome
    .setName(group)
    .setDescription('join and leave cards')
    .addSubcommand((sub) => sub
      .setName('add')
      .setDescription('send the cards to a channel')
      .addChannelOption(channelOption)
      .addIntegerOption((option) => option
        .setName('self_destruct')
        .setDescription('delete each card after this many seconds — 0 keeps it')
        .setMinValue(0)
        .setMaxValue(600))
      .addBooleanOption((option) => option
        .setName('pingable')
        .setDescription('mention the member in the card')))
    .addSubcommand((sub) => sub
      .setName('remove')
      .setDescription('stop sending the cards to a channel')
      .addChannelOption(channelOption))
    .addSubcommand((sub) => sub
      .setName('text')
      .setDescription('change what a card says')
      .addStringOption((option) => option
        .setName('which')
        .setDescription('join or leave')
        .setRequired(true)
        .addChoices({ name: 'join', value: 'join' }, { name: 'leave', value: 'leave' }))
      .addStringOption((option) => option
        .setName('text')
        .setDescription('use {user} {name} {server} {count}')
        .setRequired(true)
        .setMaxLength(400)))
    .addSubcommand((sub) => sub.setName('test').setDescription('post the cards here'))
    .addSubcommand((sub) => sub.setName('off').setDescription('stop every welcome card')));

function view(guildId) {
  const state = settings(guildId);

  const box = shell();
  heading(box, {
    title: 'welcome',
    note: state.channels.length
      ? `${state.channels.length} channel${state.channels.length === 1 ? '' : 's'}`
      : 'off',
  });
  box.addSeparatorComponents(rule());
  box.addTextDisplayComponents(facts([
    ['join text', state.texts.join],
    ['leave text', state.texts.leave],
  ]));

  if (state.channels.length) {
    box.addSeparatorComponents(rule());
    box.addTextDisplayComponents(text(state.channels.map((entry) => {
      const timer = entry.selfDestruct > 0 ? `deletes after ${entry.selfDestruct}s` : 'stays put';
      return `\`›\` <#${entry.channelId}>  —  ${timer} · ${entry.pingable ? 'pings the member' : 'no ping'}`;
    }).join('\n')));
  } else {
    box.addTextDisplayComponents(quiet('no channels yet — `/config welcome add`'));
  }
  box.addTextDisplayComponents(quiet('placeholders — {user} {name} {server} {count}'));

  return payload(box);
}

function setText(guildId, which, value) {
  const state = settings(guildId);
  const body = String(value ?? '').trim().slice(0, 400);

  save(guildId, { texts: { ...state.texts, [which]: body } });

  return `the **${which}** sentence is now — ${body}`;
}

function addChannel(guildId, { channelId, selfDestruct = 0, pingable = false }) {
  const state = add(guildId, { channelId, selfDestruct, pingable });
  const entry = state.channels.find((value) => value.channelId === channelId);

  const timer = entry.selfDestruct > 0 ? `, deletes after ${entry.selfDestruct}s` : '';
  return `welcome and goodbye go to <#${channelId}>${timer}${entry.pingable ? ', member mentioned' : ''}`;
}

export async function execute(interaction) {
  const sub = interaction.options.getSubcommand();

  if (sub === 'off') {
    save(interaction.guildId, { channels: [] });
    await interaction.reply(done(interaction, 'every welcome card is off.'));
    return;
  }

  if (sub === 'remove') {
    const channel = interaction.options.getChannel('channel');
    removeChannel(interaction.guildId, channel.id);
    await interaction.reply(done(interaction, `welcome cards no longer go to <#${channel.id}>`));
    return;
  }

  if (sub === 'text') {
    const which = interaction.options.getString('which');
    const value = interaction.options.getString('text');
    await interaction.reply(done(interaction, setText(interaction.guildId, which, value)));
    return;
  }

  if (sub === 'test') {
    const state = settings(interaction.guildId);
    const targets = state.channels.length ? state.channels.map((entry) => entry.channelId) : [interaction.channelId];

    for (const id of targets) {
      const channel = interaction.guild.channels.cache.get(id)
        ?? await interaction.guild.channels.fetch(id).catch(() => null);
      if (!channel?.isTextBased?.()) continue;

      await channel.send({
        ...card(interaction.member, {
          title: 'welcome',
          note: `${interaction.guild.name} · member ${interaction.guild.memberCount}`,
          message: state.texts.join,
          foot: 'this is what a new member sees',
        }),
        allowedMentions: { parse: [] },
      }).catch(() => {});
    }

    await interaction.reply(done(interaction, 'posted a test card.'));
    return;
  }

  const channel = interaction.options.getChannel('channel');
  if (!channel?.isTextBased?.()) {
    await interaction.reply(oops('pick a text channel.'));
    return;
  }

  const selfDestruct = interaction.options.getInteger('self_destruct') ?? 0;
  const pingable = interaction.options.getBoolean('pingable') ?? false;

  await interaction.reply(done(interaction, addChannel(interaction.guildId, {
    channelId: channel.id,
    selfDestruct,
    pingable,
  })));
}

export async function prefix(message, args) {
  if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
    await message.reply(oops('you need **manage server** for that.'));
    return;
  }

  let rest = args;

  if (rest[0]?.toLowerCase() === 'welcome') rest = rest.slice(1);
  if (['join', 'leave'].includes(rest[0]?.toLowerCase())) rest = rest.slice(1);

  const head = rest[0]?.toLowerCase();
  const guildId = message.guild.id;
  const state = settings(guildId);
  const channel = message.mentions.channels?.first?.() ?? null;

  if (!head) {
    await message.reply(view(guildId));
    return;
  }

  if (head === 'off') {
    save(guildId, { channels: [] });
    await message.reply(done(message, 'every welcome card is off.'));
    return;
  }

  if (head === 'test') {
    const targets = state.channels.length ? state.channels.map((entry) => entry.channelId) : [message.channel.id];

    for (const id of targets) {
      const target = message.guild.channels.cache.get(id)
        ?? await message.guild.channels.fetch(id).catch(() => null);
      if (!target?.isTextBased?.()) continue;

      await target.send({
        ...card(message.member, {
          title: 'welcome',
          note: `${message.guild.name} · member ${message.guild.memberCount}`,
          message: state.texts.join,
          foot: 'this is what a new member sees',
        }),
        allowedMentions: { parse: [] },
      }).catch(() => {});
    }

    await message.reply(done(message, 'posted a test card.'));
    return;
  }

  if (head === 'text' || head === 'message') {
    const which = head === 'text' && rest[1]?.toLowerCase() === 'leave' ? 'leave' : 'join';
    const body = (head === 'text' ? rest.slice(2) : rest.slice(1)).join(' ').trim();

    if (!body) {
      await message.reply(oops('usage — `,config welcome text <join|leave> <words>`'));
      return;
    }

    await message.reply(done(message, setText(guildId, which, body)));
    return;
  }

  if (head === 'remove') {
    if (!channel) {
      await message.reply(oops('usage — `,config welcome remove #channel`'));
      return;
    }

    removeChannel(guildId, channel.id);
    await message.reply(done(message, `welcome cards no longer go to <#${channel.id}>`));
    return;
  }

  if (head === 'add' || channel) {
    if (!channel) {
      await message.reply(oops('usage — `,config welcome add #channel [seconds] [true|false]`'));
      return;
    }

    const seconds = rest.slice(1)
      .map((value) => Number(value))
      .find((value) => Number.isFinite(value) && value >= 0 && value <= 600) ?? 0;
    const pingable = rest.slice(1).some((value) => /^(true|yes|on|ping)$/i.test(value));

    await message.reply(done(message, addChannel(guildId, {
      channelId: channel.id,
      selfDestruct: seconds,
      pingable,
    })));
    return;
  }

  await message.reply(view(guildId));
}
