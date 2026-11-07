import { EmbedBuilder, PermissionFlagsBits } from 'discord.js';

/** `,slowmode <0-21600>` — 0 turns it off. */

export const name = 'slowmode';

export async function prefix(message, args) {
  const err = (text) => message.reply({ embeds: [new EmbedBuilder().setColor(0xED4245).setDescription(text)] });

  if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
    return err('⚠️ You need **Manage Channels** permission.');
  }

  const seconds = parseInt(args[0], 10);
  if (isNaN(seconds) || seconds < 0 || seconds > 21600) {
    return err('⚠️ Usage: `,slowmode <0-21600>`\n`0` disables slowmode. Max is `21600` (6 hours).');
  }

  await message.channel.setRateLimitPerUser(seconds);

  const text = seconds === 0
    ? '✅ Slowmode **disabled** in this channel.'
    : `⚙️ Slowmode set to **${seconds}s** in this channel.`;

  return message.reply({ embeds: [new EmbedBuilder().setColor(0x5865F2).setDescription(text)] });
}
