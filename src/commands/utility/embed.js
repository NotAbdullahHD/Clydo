import { MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { parse } from '../../lib/embed-json.js';
import { done, ephemeral, oops } from '../../lib/line.js';
import { prefix as marker } from '../../lib/prefix.js';

/**
 * `/embed <json>` — post an embed or a components v2 container, untouched.
 *
 * the builder emits discord's own shape, so this takes it as it comes and only
 * refuses what discord would refuse anyway: a sentence here beats a 400 from
 * the api. a pasted code fence is stripped, because that is how it copies.
 */

export const name = 'embed';

export const data = new SlashCommandBuilder()
  .setName('embed')
  .setDescription('post an embed or a components v2 container from json')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
  .addStringOption((option) => option
    .setName('json')
    .setDescription('the json from the builder — /embeds on the site')
    .setRequired(true)
    .setMaxLength(6000))
  .addChannelOption((option) => option
    .setName('channel')
    .setDescription('where it goes — this channel if left alone'));

/** null when the channel cannot take a message from slink. */
async function place(guild, channel, payload) {
  const target = channel?.isTextBased?.()
    ? channel
    : await guild?.channels?.fetch(channel?.id).catch(() => null) ?? null;

  if (!target?.isTextBased?.()) return null;
  if (!target.permissionsFor(guild.members.me)?.has(PermissionFlagsBits.SendMessages)) return null;

  await target.send(payload);

  return target;
}

export async function execute(interaction) {
  const { payload, problem } = parse(interaction.options.getString('json'));

  if (problem || !payload) {
    await interaction.reply(ephemeral(oops(problem ?? 'that json does not hold an embed.')));
    return;
  }

  const channel = interaction.options.getChannel('channel') ?? interaction.channel;

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const target = await place(interaction.guild, channel, payload);

  await interaction.editReply(
    target ? done(interaction, `posted in <#${target.id}>.`) : oops('i cannot post in that channel.'),
  );
}

export async function prefix(message, args) {
  if (!message.member?.permissions.has(PermissionFlagsBits.ManageMessages)) {
    await message.reply(oops('you need **manage messages** for that.'));
    return;
  }

  // read the raw tail so a pasted block keeps its newlines and spacing.
  const raw = message.content
    .slice(marker.length)
    .trim()
    .replace(/^\S+\s*/, '');

  const { payload, problem } = parse(raw || args.join(' '));

  if (problem || !payload) {
    await message.reply(oops(problem ?? 'that json does not hold an embed.'));
    return;
  }

  await message.reply(payload);
}
