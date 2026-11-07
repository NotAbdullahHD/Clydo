import { amount, bad, coin, get, good, short, update } from '../../lib/economy.js';

/** `,dep [amount|all]` — wallet into the bank. */

export const name = 'deposit';
export const names = ['dep'];

export async function prefix(message, args) {
  const tag = `<@${message.author.id}>`;
  const record = await get(message.author.id);
  const value = amount(args[0], record.wallet);

  const reply = (embed) => message.reply({ embeds: [embed], allowedMentions: { parse: [] } });

  if (!value) {
    await reply(bad(args[0]?.toLowerCase() === 'all' && record.wallet === 0
      ? `${tag}: your wallet is empty.`
      : `${tag}: usage — \`,dep <amount|all>\``));
    return;
  }

  if (value > record.wallet) {
    await reply(bad(`${tag}: you only have ${coin} ${short(record.wallet)} on you.`));
    return;
  }

  await update(message.author.id, (row) => {
    row.wallet -= value;
    row.bank += value;
    return row;
  }, message.author.username);

  await reply(good(`${tag}: deposited ${coin} ${short(value)} into your bank.`));
}
