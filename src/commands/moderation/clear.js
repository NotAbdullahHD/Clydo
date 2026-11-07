import { EmbedBuilder, PermissionFlagsBits } from 'discord.js';

/** `,clear 1-100` — bulk delete, confirmation removes itself after three seconds. */

export const name = 'clear';

export async function prefix(message, args) {
  if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
    return message.reply({
      embeds: [new EmbedBuilder().setColor(0xED4245).setDescription('⚠️ Missing **Manage Messages** permission.')],
    });
  }

  const amount = parseInt(args[0], 10);
  if (!amount || amount < 1 || amount > 100) {
    return message.reply({
      embeds: [new EmbedBuilder().setColor(0xED4245).setDescription('⚠️ Usage: `,clear 1-100`')],
    });
  }

  await message.channel.bulkDelete(amount, true);

  const msg = await message.channel.send({
    embeds: [new EmbedBuilder().setColor(0x57F287).setDescription(`✅ Cleared **${amount}** messages.`)],
  });

  setTimeout(() => msg.delete().catch(() => {}), 3000);
}
