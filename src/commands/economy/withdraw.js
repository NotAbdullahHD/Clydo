import { amount, currency, get, money, update } from '../../lib/economy.js';
import { panel } from '../../lib/theme.js';

/** `,with [amount|all]` — bank back into the wallet. */

export const name = 'withdraw';
export const names = ['with'];

export async function prefix(message, args) {
  const record = await get(message.author.id);
  const value = amount(args[0], record.bank);

  if (!value) {
    await message.reply({
      embeds: [panel({
        title: 'withdraw',
        description: args[0]?.toLowerCase() === 'all' && record.bank === 0
          ? 'your bank is empty.'
          : 'usage — `,with <amount|all>`',
      })],
    });
    return;
  }

  if (value > record.bank) {
    await message.reply({
      embeds: [panel({
        title: 'withdraw',
        description: `you only have **${money(record.bank)}** ${currency} in the bank.`,
      })],
    });
    return;
  }

  await update(message.author.id, (row) => {
    row.bank -= value;
    row.wallet += value;
    return row;
  }, message.author.username);

  await message.reply({
    embeds: [panel({
      title: 'withdraw',
      description: `withdrew **${money(value)}** ${currency} from your bank — wallet **${money(record.wallet + value)}**`,
    })],
  });
}
