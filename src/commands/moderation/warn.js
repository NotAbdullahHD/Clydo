import { EmbedBuilder, PermissionFlagsBits } from 'discord.js';

/** `,warn @user [reason]` — DMs the warning, then confirms in channel. */

export const name = 'warn';

export async function prefix(message, args) {
  const err = (text) => message.reply({ embeds: [new EmbedBuilder().setColor(0xED4245).setDescription(text)] });

  if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
    return err('You need **Moderate Members** permission.');
  }

  const target = message.mentions.members.first();
  if (!target) return err('Usage: `,warn @user [reason]`');

  const reason = args.slice(1).join(' ') || 'No reason provided';

  await target.user.send({
    embeds: [
      new EmbedBuilder()
        .setColor(0xFEE75C)
        .setAuthor({ name: `Warning — ${message.guild.name}`, iconURL: message.guild.iconURL() ?? undefined })
        .setDescription(`You were warned by **${message.author.username}**.\n**Reason:** ${reason}`)
        .setTimestamp(),
    ],
  }).catch(() => {});

  return message.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(0xFEE75C)
        .setDescription(`**${target.user.username}** has been warned.\n**Reason:** ${reason}`),
    ],
  });
}
