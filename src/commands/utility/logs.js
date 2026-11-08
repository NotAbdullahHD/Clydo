import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { facts, heading, payload, quiet, rule, shell } from '../../lib/card.js';
import { set } from '../../lib/config.js';
import { done, oops } from '../../lib/line.js';
import { kinds, settings } from '../../lib/logging.js';

/**
 * `/logs` and `,logs` — where the server writes things down.
 *
 * add routes one event to a channel, ignore mutes a member or a channel, and
 * the bare status card says which event goes where.
 */

export const name = 'logs';
export const names = ['logging'];

const channelOption = (option) => option
  .setName('channel')
  .setDescription('the channel it goes to')
  .setRequired(true);

const eventOption = (option) => option
  .setName('event')
  .setDescription('what to record')
  .setRequired(true)
  .addChoices(...kinds.map((kind) => ({ name: kind, value: kind })));

// discord has no member option type — a user option resolves through getMember.
const ignoreOptions = (sub) => sub
  .addUserOption((option) => option
    .setName('member')
    .setDescription('whose messages are never recorded'))
  .addChannelOption((option) => option
    .setName('channel')
    .setDescription('a channel that is never recorded'));

export const data = new SlashCommandBuilder()
  .setName('logs')
  .setDescription('where the server writes things down')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand((sub) => sub
    .setName('add')
    .setDescription('send one kind of event to a channel')
    .addChannelOption(channelOption)
    .addStringOption(eventOption))
  .addSubcommand((sub) => sub
    .setName('remove')
    .setDescription('stop sending one kind of event')
    .addChannelOption(channelOption)
    .addStringOption(eventOption))
  .addSubcommandGroup((group) => group
    .setName('ignore')
    .setDescription('never record these')
    .addSubcommand((sub) => ignoreOptions(sub.setName('add').setDescription('mute a member or a channel')))
    .addSubcommand((sub) => ignoreOptions(sub.setName('remove').setDescription('unmute a member or a channel'))))
  .addSubcommand((sub) => sub.setName('off').setDescription('stop every log'))
  .addSubcommand((sub) => sub.setName('status').setDescription('what is recorded and where'));

const save = (guildId, change) => set(guildId, 'logging', { ...settings(guildId), ...change });

function route(guildId, channelId, kind) {
  const state = settings(guildId);
  save(guildId, { routes: { ...state.routes, [kind]: channelId } });

  return `**${kind}** logs go to <#${channelId}>`;
}

function unroute(guildId, channelId, kind) {
  const state = settings(guildId);
  if (state.routes[kind] !== channelId) return null;

  const next = { ...state.routes };
  delete next[kind];
  save(guildId, { routes: next });

  return `**${kind}** logs are off`;
}

function mute(guildId, { memberId = null, channelId = null }, on) {
  const state = settings(guildId);
  const list = memberId ? 'members' : 'channels';
  const id = memberId ?? channelId;
  if (!id) return null;

  const has = state.ignore[list].includes(id);
  if (has === on) return `${id} was already ${on ? 'muted' : 'heard'}.`;

  const next = on
    ? [...state.ignore[list], id]
    : state.ignore[list].filter((value) => value !== id);

  save(guildId, { ignore: { ...state.ignore, [list]: next } });

  const label = memberId ? `<@${id}>` : `<#${id}>`;
  return `${label} is ${on ? 'muted' : 'heard again'}`;
}

function view(guildId) {
  const state = settings(guildId);
  const on = kinds.filter((kind) => state.routes[kind]).length;

  const box = shell();
  heading(box, {
    title: 'logs',
    note: `${on}/${kinds.length} events · ${state.ignore.members.length} members muted · ${state.ignore.channels.length} channels muted`,
  });
  box.addSeparatorComponents(rule());
  box.addTextDisplayComponents(facts(
    kinds.map((kind) => [kind, state.routes[kind] ? `<#${state.routes[kind]}>` : 'off']),
  ));
  box.addTextDisplayComponents(quiet('`/logs add` routes one event · `/logs ignore add` mutes a member or channel'));

  return payload(box);
}

export async function execute(interaction) {
  const group = interaction.options.getSubcommandGroup(false);
  const sub = interaction.options.getSubcommand();

  if (group === 'ignore') {
    const channel = interaction.options.getChannel('channel');
    const member = interaction.options.getMember('member');

    if (!channel && !member) {
      await interaction.reply(oops('pick a **member** or a **channel** to ignore.'));
      return;
    }

    const text = mute(interaction.guildId, { memberId: member?.id, channelId: channel?.id }, sub === 'add');
    await interaction.reply(done(interaction, text));
    return;
  }

  if (sub === 'off') {
    save(interaction.guildId, { routes: {} });
    await interaction.reply(done(interaction, 'every log is off.'));
    return;
  }

  if (sub === 'status') {
    await interaction.reply(view(interaction.guildId));
    return;
  }

  const channel = interaction.options.getChannel('channel');
  const kind = interaction.options.getString('event');

  if (sub === 'add') {
    await interaction.reply(done(interaction, route(interaction.guildId, channel.id, kind)));
    return;
  }

  const text = unroute(interaction.guildId, channel.id, kind);
  await interaction.reply(text ? done(interaction, text) : oops(`**${kind}** does not go to <#${channel.id}>.`));
}

const idOf = (value) => String(value ?? '').match(/\d{17,20}/)?.[0] ?? null;

export async function prefix(message, args) {
  if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
    await message.reply(oops('you need **manage server** for that.'));
    return;
  }

  const head = args[0]?.toLowerCase();
  const channel = message.mentions.channels?.first?.() ?? idOf(args[1]);
  const kind = args.map((value) => value.toLowerCase()).find((value) => kinds.includes(value));
  const guildId = message.guild.id;

  if (!head) {
    await message.reply(view(guildId));
    return;
  }

  if (head === 'off') {
    save(guildId, { routes: {} });
    await message.reply(done(message, 'every log is off.'));
    return;
  }

  if (head === 'ignore') {
    const on = args[1]?.toLowerCase() !== 'remove';
    const target = message.mentions.members?.first?.() ?? message.mentions.channels?.first?.();
    const text = mute(guildId, {
      memberId: target?.user ? target.id : null,
      channelId: target && !target.user ? target.id : null,
    }, on);

    await message.reply(text ? done(message, text) : oops('mention a **member** or a **channel**.'));
    return;
  }

  if (head === 'add' || head === 'remove') {
    if (!channel || !kind) {
      await message.reply(oops('usage — `,logs add #channel <event>`, `,logs remove #channel <event>`'));
      return;
    }

    const id = typeof channel === 'string' ? channel : channel.id;

    if (head === 'add') {
      await message.reply(done(message, route(guildId, id, kind)));
      return;
    }

    const text = unroute(guildId, id, kind);
    await message.reply(text ? done(message, text) : oops(`**${kind}** does not go to <#${id}>.`));
    return;
  }

  // `,logs #channel` is the one-step setup: everything to one place.
  if (channel && typeof channel !== 'string') {
    const state = settings(guildId);
    const routes = { ...state.routes };

    for (const value of kinds) routes[value] = channel.id;
    save(guildId, { routes });

    await message.reply(done(message, `every event goes to <#${channel.id}>`));
    return;
  }

  await message.reply(view(guildId));
}
