import { EmbedBuilder, PermissionFlagsBits } from 'discord.js';

/** `,timeout @user <10m|2h|1d> [reason]` — 5 seconds to 28 days. */

export const name = 'timeout';

const units = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };

export async function prefix(message, args) {
  const err = (text) => message.reply({ embeds: [new EmbedBuilder().setColor(0xED4245).setDescription(text)] });

  if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
    return err('⚠️ You need **Moderate Members** permission.');
  }

  const target = message.mentions.members.first();
  if (!target) return err('⚠️ Usage: `,timeout @user <duration> [reason]`\nExamples: `10m` `1h` `2d`');

  const durationStr = args[1];
  if (!durationStr) return err('⚠️ Please provide a duration. Examples: `10m` `1h` `2d`');

  const match = durationStr.match(/^(\d+)(s|m|h|d)$/i);
  if (!match) return err('⚠️ Invalid duration format. Use `10m`, `2h`, `1d` etc.');

  const ms = parseInt(match[1], 10) * units[match[2].toLowerCase()];

  if (ms > 28 * 24 * 60 * 60 * 1000) return err('❌ Maximum timeout duration is 28 days.');
  if (ms < 5000) return err('❌ Minimum timeout duration is 5 seconds.');

  const reason = args.slice(2).join(' ') || 'No reason provided';
  if (!target.moderatable) return err("❌ I can't timeout this user (check my role position).");

  await target.timeout(ms, reason);

  return message.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(0xFEE75C)
        .setDescription(`⚙️ **${target.user.username}** timed out for **${durationStr}**.\n**Reason:** ${reason}`),
    ],
  });
}
