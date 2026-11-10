import { AttachmentBuilder, SlashCommandBuilder } from 'discord.js';
import { loadAvatar } from '../../lib/ship-card.js';
import { render } from '../../lib/level-card.js';
import { nextRole, profile } from '../../lib/levels.js';

/**
 * `/level` and `,level` — the card.
 *
 * level, xp, rank and the distance to the next one, drawn as an image so the
 * numbers can be typographic instead of another embed.
 */

export const name = 'level';

export const data = new SlashCommandBuilder()
  .setName('level')
  .setDescription('level, xp and rank on a card')
  .addUserOption((option) => option
    .setName('user')
    .setDescription('someone else — you by default'));

async function card(guild, member, user) {
  const state = profile(guild.id, user.id);
  const next = nextRole(guild, state.level);
  const avatar = await loadAvatar(user.displayAvatarURL({ size: 256, extension: 'png' }));

  const png = await render({
    name: member?.displayName ?? user.username,
    avatar,
    level: state.level,
    xp: state.xp,
    rank: state.rank,
    into: state.into,
    span: state.span,
    percent: state.percent,
    role: next ? next.role.name : null,
  });

  return new AttachmentBuilder(png, { name: `level-${state.level}.png` });
}

export async function execute(interaction) {
  const user = interaction.options.getUser('user') ?? interaction.user;
  const member = interaction.guild.members.cache.get(user.id)
    ?? await interaction.guild.members.fetch(user.id).catch(() => null);

  await interaction.deferReply();

  await interaction.editReply({
    files: [await card(interaction.guild, member, user)],
    allowedMentions: { parse: [] },
  });
}

export async function prefix(message, args) {
  if (!message.guild) return;

  const user = message.mentions.users?.first?.()
    ?? (args[0] ? await message.client.users.fetch(args[0].replace(/[<@!>]/g, '')).catch(() => null) : null)
    ?? message.author;

  const member = message.guild.members.cache.get(user.id)
    ?? await message.guild.members.fetch(user.id).catch(() => null);

  await message.reply({
    files: [await card(message.guild, member, user)],
    allowedMentions: { parse: [] },
  });
}
