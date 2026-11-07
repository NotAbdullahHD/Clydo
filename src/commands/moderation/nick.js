import { EmbedBuilder, PermissionFlagsBits } from 'discord.js';

/** `,nick @user <name>` — omit the name to reset. */

export const name = 'nick';
export const names = ['nickname'];

export async function prefix(message, args) {
  const err = (text) => message.reply({ embeds: [new EmbedBuilder().setColor(0xED4245).setDescription(text)] });

  if (!message.member.permissions.has(PermissionFlagsBits.ManageNicknames)) {
    return err('You need **Manage Nicknames** permission.');
  }

  const target = message.mentions.members.first();
  if (!target) return err('Usage: `,nick @user <new nickname>` or `,nick @user` to reset.');

  const newNick = args.slice(1).join(' ').trim() || null;

  if (!target.manageable) return err("I can't change this user's nickname (check role hierarchy).");

  const old = target.nickname || target.user.username;
  await target.setNickname(newNick);

  return message.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(0x57F287)
        .setDescription(`Changed **${target.user.username}**'s nickname.\n**Before:** ${old}\n**After:** ${newNick || target.user.username}`),
    ],
  });
}
