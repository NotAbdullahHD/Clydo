import { amount, currency, get, money, update } from '../../lib/economy.js';
import { panel } from '../../lib/theme.js';

/** `,dep [amount|all]` — wallet into the bank. */

export const name = 'deposit';
export const names = ['dep'];

export async function prefix(message, args) {
  const record = await get(message.author.id);
  const value = amount(args[0], record.wallet);

  if (!value) {
    await message.reply({
      embeds: [panel({
        title: 'deposit',
        description: args[0]?.toLowerCase() === 'all' && record.wallet === 0
          ? 'your wallet is empty.'
          : 'usage — `,dep <amount|all>`',
      })],
    });
    return;
  }

  if (value > record.wallet) {
    await message.reply({
      embeds: [panel({
        title: 'deposit',
        description: `you only have **${money(record.wallet)}** ${currency} on you.`,
      })],
    });
    return;
  }

  await update(message.author.id, (row) => {
    row.wallet -= value;
    row.bank += value;
    return row;
  }, message.author.username);

  await message.reply({
    embeds: [panel({
      title: 'deposit',
      description: `deposited **${money(value)}** ${currency} — bank **${money(record.bank + value)}**`,
    })],
  });
}
