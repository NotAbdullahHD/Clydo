import { PermissionFlagsBits } from 'discord.js';
import { block, entry, panel } from '../../lib/theme.js';

/** `,purge 1-100` — the same cleanup, now prefix only. */

export const name = 'purge';

const maxAgeDays = 14;

export async function prefix(message, args) {
  if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
    await message.reply({ embeds: [panel({ title: 'purge', description: 'you need manage messages for that.' })] });
    return;
  }

  const amount = Number(args[0]);

  if (!Number.isInteger(amount) || amount < 1 || amount > 100) {
    await message.reply({ embeds: [panel({ title: 'purge', description: 'usage — `,purge 1-100`' })] });
    return;
  }

  const deleted = await message.channel.bulkDelete(amount, true);
  const skipped = amount - deleted.size;

  const lines = [`cleared ${deleted.size} message${deleted.size === 1 ? '' : 's'}.`];

  if (skipped > 0) {
    lines.push('', entry('skipped', `${skipped} older than ${maxAgeDays} days`));
  }

  await message.reply({
    embeds: [panel({ title: 'purge', description: block(...lines), footer: `by ${message.author.username}` })],
  });
}
