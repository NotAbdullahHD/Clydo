import { amount, bad, coin, get, good, short, update } from '../../lib/economy.js';

/** `,with [amount|all]` — bank back into the wallet. */

export const name = 'withdraw';
export const names = ['with'];

export async function prefix(message, args) {
  const tag = `<@${message.author.id}>`;
  const record = await get(message.author.id);
  const value = amount(args[0], record.bank);

  const reply = (embed) => message.reply({ embeds: [embed], allowedMentions: { parse: [] } });

  if (!value) {
    await reply(bad(args[0]?.toLowerCase() === 'all' && record.bank === 0
      ? `${tag}: your bank is empty.`
      : `${tag}: usage — \`,with <amount|all>\``));
    return;
  }

  if (value > record.bank) {
    await reply(bad(`${tag}: you only have ${coin} ${short(record.bank)} in the bank.`));
    return;
  }

  await update(message.author.id, (row) => {
    row.bank -= value;
    row.wallet += value;
    return row;
  }, message.author.username);

  await reply(good(`${tag}: withdrew ${coin} ${short(value)} from your bank.`));
}
