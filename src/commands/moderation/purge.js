import { PermissionFlagsBits } from 'discord.js';
import { heading, payload, quiet, rule, shell, simple, text } from '../../lib/card.js';
import { confirm } from '../../lib/confirm.js';
import { palette } from '../../lib/theme.js';

/** `,purge 1-100` — bulk delete, and it asks before it does. */

export const name = 'purge';
export const names = ['c'];

const maxAgeDays = 14;

export async function prefix(message, args) {
  if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
    await message.reply(simple({
      accent: palette.bad,
      title: 'purge',
      message: 'you need manage messages for that.',
    }));
    return;
  }

  const amount = Number(args[0]);

  if (!Number.isInteger(amount) || amount < 1 || amount > 100) {
    await message.reply(simple({
      accent: palette.bad,
      title: 'purge',
      message: 'usage — `,purge 1-100`',
    }));
    return;
  }

  await confirm(message, {
    title: 'purge',
    question: `delete the last **${amount}** message${amount === 1 ? '' : 's'} here?`,
    detail: `anything older than ${maxAgeDays} days is skipped by discord.`,
    yes: 'delete',
    onConfirm: async (press) => {
      const deleted = await message.channel.bulkDelete(amount, true);
      const skipped = amount - deleted.size;

      const box = shell(palette.good);
      heading(box, { title: 'purge', note: `by ${message.author.username}` });
      box.addSeparatorComponents(rule());
      box.addTextDisplayComponents(text(`cleared **${deleted.size}** message${deleted.size === 1 ? '' : 's'}.`));
      if (skipped > 0) {
        box.addTextDisplayComponents(quiet(`${skipped} skipped — older than ${maxAgeDays} days`));
      }

      const receipt = payload(box);

      // the prompt is inside the deleted range, so the receipt goes out fresh
      await press.editReply(receipt).catch(() => message.channel.send(receipt).catch(() => {}));
    },
  });
}
