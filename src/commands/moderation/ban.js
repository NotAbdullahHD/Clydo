import { EmbedBuilder, PermissionFlagsBits } from 'discord.js';

/** `,ban @user [reason]` — DM first, then ban, exactly as labubu did it. */

export const name = 'ban';

export async function prefix(message, args) {
  const err = (text) => message.reply({ embeds: [new EmbedBuilder().setColor(0xED4245).setDescription(text)] });
  const ok = (text) => message.reply({ embeds: [new EmbedBuilder().setColor(0x57F287).setDescription(text)] });

  if (!message.member.permissions.has(PermissionFlagsBits.BanMembers)) {
    return err(' You need **Ban Members** permission.');
  }

  const member = message.mentions.members.first();
  if (!member) return err(' Usage: `,ban @user [reason]`');
  if (!member.bannable) return err('I cannot ban this user (check role hierarchy).');
  if (member.id === message.author.id) return err('You cannot ban yourself.');

  const reason = args.slice(1).join(' ') || 'No reason provided';

  await member.user.send({
    embeds: [
      new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle(`🔨 Banned from ${message.guild.name}`)
        .setDescription(`**Reason:** ${reason}`),
    ],
  }).catch(() => {});

  await member.ban({ reason });

  return ok(`**${member.user.tag}** has been banned.\n**Reason:** ${reason}`);
}
