import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { shape } from '../../lib/bridge.js';
import { facts, heading, listing, payload, quiet, rule, shell, simple } from '../../lib/card.js';
import { patch } from '../../lib/config.js';
import { oops } from '../../lib/line.js';
import { blocker, emojiKey, limit, settings } from '../../lib/roles.js';
import { palette } from '../../lib/theme.js';

/**
 * `,roles auto @role` — roles on join, and roles from a reaction.
 */

export const name = 'roles';
export const names = ['autorole', 'reactionrole'];

export const data = new SlashCommandBuilder()
  .setName('roles')
  .setDescription('roles on join, and roles from a reaction')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommandGroup((group) => group
    .setName('autorole')
    .setDescription('roles every new member gets')
    .addSubcommand((sub) => sub
      .setName('add')
      .setDescription('give a role on join')
      .addRoleOption((option) => option.setName('role').setDescription('the role').setRequired(true)))
    .addSubcommand((sub) => sub
      .setName('remove')
      .setDescription('stop giving a role on join')
      .addRoleOption((option) => option.setName('role').setDescription('the role').setRequired(true)))
    .addSubcommand((sub) => sub.setName('clear').setDescription('clear the whole autorole list')))
  .addSubcommandGroup((group) => group
    .setName('reaction')
    .setDescription('roles from a reaction on a message')
    .addSubcommand((sub) => sub
      .setName('add')
      .setDescription('bind an emoji to a role')
      .addStringOption((option) => option.setName('message').setDescription('message link or id').setRequired(true))
      .addStringOption((option) => option.setName('emoji').setDescription('the reaction').setRequired(true))
      .addRoleOption((option) => option.setName('role').setDescription('the role').setRequired(true)))
    .addSubcommand((sub) => sub
      .setName('remove')
      .setDescription('unbind an emoji')
      .addStringOption((option) => option.setName('message').setDescription('message link or id').setRequired(true))
      .addStringOption((option) => option.setName('emoji').setDescription('the reaction').setRequired(true))));

export async function execute(interaction) {
  const group = interaction.options.getSubcommandGroup();
  const sub = interaction.options.getSubcommand();
  const role = interaction.options.getRole('role');

  if (group === 'autorole') {
    const args = sub === 'clear' ? ['auto', 'off'] : ['auto', sub];
    await prefix(shape(interaction, args, { role }), args);
    return;
  }

  const message = interaction.options.getString('message');
  const emoji = interaction.options.getString('emoji');
  const args = sub === 'remove'
    ? ['reaction', 'remove', message, emoji]
    : ['reaction', message, emoji];

  await prefix(shape(interaction, args, { role }), args);
}

const usage = 'usage — `,roles auto @role`, `,roles auto remove @role`, `,roles auto off`, `,roles reaction <message> <emoji> @role`, `,roles reaction remove <message> <emoji>`';

const idIn = (value) => String(value ?? '').match(/\d{17,20}/g)?.at(-1) ?? null;

async function status(message) {
  const state = settings(message.guild.id);

  const box = shell();
  heading(box, {
    title: 'roles',
    note: `${state.auto.length}/${limit.auto} autoroles · ${state.reactions.length}/${limit.reactions} reaction roles`,
  });
  box.addSeparatorComponents(rule());
  box.addTextDisplayComponents(facts([
    ['autorole', state.auto.length ? state.auto.map((id) => `<@&${id}>`).join(' ') : 'none'],
  ]));

  if (state.reactions.length) {
    box.addTextDisplayComponents(listing(state.reactions.map(
      (entry) => `\`›\` ${entry.label ?? entry.emoji}  —  <@&${entry.roleId}>`,
    )));
  } else {
    box.addTextDisplayComponents(quiet('no reaction roles yet.'));
  }

  await message.reply({ ...payload(box), allowedMentions: { parse: [] } });
}

export async function prefix(message, args) {
  if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
    await message.reply(simple({ accent: palette.bad, title: 'roles', message: 'you need manage server for that.' }));
    return;
  }

  const head = args[0]?.toLowerCase();
  const state = settings(message.guild.id);

  if (!head) {
    await status(message);
    return;
  }

  if (head === 'auto' || head === 'autorole') {
    const sub = args[1]?.toLowerCase();

    if (sub === 'off') {
      await patch(message.guild.id, 'roles', { ...state, auto: [] });
      await message.reply(simple({ accent: palette.good, title: 'roles', message: 'autoroles cleared.' }));
      return;
    }

    const role = message.mentions.roles.first();

    if (!role) {
      await message.reply(simple({ accent: palette.bad, title: 'roles', message: usage }));
      return;
    }

    if (sub === 'remove') {
      await patch(message.guild.id, 'roles', { ...state, auto: state.auto.filter((id) => id !== role.id) });
      await message.reply(simple({ accent: palette.good, title: 'roles', message: `<@&${role.id}> is no longer given on join.` }));
      return;
    }

    if (state.auto.includes(role.id)) {
      await message.reply(simple({ accent: palette.bad, title: 'roles', message: 'that role is already an autorole.' }));
      return;
    }

    if (state.auto.length >= limit.auto) {
      await message.reply(simple({ accent: palette.bad, title: 'roles', message: `an autorole list stops at ${limit.auto}.` }));
      return;
    }

    await patch(message.guild.id, 'roles', { ...state, auto: [...state.auto, role.id] });
    await message.reply(simple({ accent: palette.good, title: 'roles', message: `new members get <@&${role.id}>.` }));
    return;
  }

  if (head === 'reaction' || head === 'reactionrole') {
    const removing = args[1]?.toLowerCase() === 'remove';
    const rest = removing ? args.slice(2) : args.slice(1);
    const messageId = idIn(rest[0]);
    const raw = rest[1];

    if (!messageId || !raw) {
      await message.reply(simple({ accent: palette.bad, title: 'roles', message: usage }));
      return;
    }

    const key = emojiKey({ id: raw.match(/^<a?:\w+:(\d+)>$/)?.[1] ?? null, name: raw });

    if (removing) {
      const next = state.reactions.filter((entry) => !(entry.messageId === messageId && entry.emoji === key));

      if (next.length === state.reactions.length) {
        await message.reply(simple({ accent: palette.bad, title: 'roles', message: 'that binding does not exist.' }));
        return;
      }

      await patch(message.guild.id, 'roles', { ...state, reactions: next });
      await message.reply(simple({ accent: palette.good, title: 'roles', message: 'binding removed.' }));
      return;
    }

    const role = message.mentions.roles.first();

    if (!role) {
      await message.reply(simple({ accent: palette.bad, title: 'roles', message: usage }));
      return;
    }

    const target = await message.channel.messages.fetch(messageId).catch(() => null);

    if (!target) {
      await message.reply(simple({ accent: palette.bad, title: 'roles', message: 'i cannot see that message in this channel.' }));
      return;
    }

    // say now what would otherwise look like the feature being broken later.
    const problem = await blocker(message.guild, role.id);
    if (problem) {
      await message.reply(oops(problem));
      return;
    }

    if (state.reactions.length >= limit.reactions) {
      await message.reply(simple({ accent: palette.bad, title: 'roles', message: `a server stops at ${limit.reactions} reaction roles.` }));
      return;
    }

    if (state.reactions.some((entry) => entry.messageId === messageId && entry.emoji === key)) {
      await message.reply(simple({ accent: palette.bad, title: 'roles', message: 'that emoji is already bound on that message.' }));
      return;
    }

    await patch(message.guild.id, 'roles', {
      ...state,
      reactions: [...state.reactions, {
        messageId,
        channelId: target.channelId,
        emoji: key,
        label: raw,
        roleId: role.id,
      }],
    });

    await target.react(raw).catch(() => {});

    await message.reply(simple({
      accent: palette.good,
      title: 'roles',
      message: `${raw} on that message now gives <@&${role.id}>.`,
    }));
    return;
  }

  await status(message);
}
