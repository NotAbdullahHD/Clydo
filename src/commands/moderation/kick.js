import { EmbedBuilder, PermissionFlagsBits } from 'discord.js';

/** `,kick @user [reason]` — DM first, then kick. */

export const name = 'kick';

export async function prefix(message, args) {
  const err = (text) => message.reply({ embeds: [new EmbedBuilder().setColor(0xED4245).setDescription(text)] });
  const ok = (text) => message.reply({ embeds: [new EmbedBuilder().setColor(0x57F287).setDescription(text)] });

  if (!message.member.permissions.has(PermissionFlagsBits.KickMembers)) {
    return err(' You need **Kick Members** permission.');
  }

  const member = message.mentions.members.first();
  if (!member) return err(' Usage: `,kick @user [reason]`');
  if (!member.kickable) return err('I cannot kick this user (check role hierarchy).');
  if (member.id === message.author.id) return err('You cannot kick yourself.');

  const reason = args.slice(1).join(' ') || 'No reason provided';

  await member.user.send({
    embeds: [
      new EmbedBuilder()
        .setColor(0xFEE75C)
        .setTitle(`👞 Kicked from ${message.guild.name}`)
        .setDescription(`**Reason:** ${reason}`),
    ],
  }).catch(() => {});

  await member.kick(reason);

  return ok(`**${member.user.tag}** has been kicked.\n**Reason:** ${reason}`);
}
