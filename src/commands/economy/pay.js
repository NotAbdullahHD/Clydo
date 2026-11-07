import { amount, currency, get, money, update } from '../../lib/economy.js';
import { panel } from '../../lib/theme.js';

/** `,pay @user <amount>` — wallet to wallet. */

export const name = 'pay';
export const names = ['give'];

export async function prefix(message, args) {
  const target = message.mentions.users.first();
  const record = await get(message.author.id);
  const value = amount(args.find((arg) => /^[\d,_]+$/.test(arg) || arg.toLowerCase() === 'all'), record.wallet);

  const say = (description) => message.reply({
    embeds: [panel({ title: 'pay', description })],
    allowedMentions: { parse: [] },
  });

  if (!target) {
    await say('usage — `,pay @user <amount>`');
    return;
  }

  if (target.id === message.author.id) {
    await say('paying yourself does nothing.');
    return;
  }

  if (target.bot) {
    await say('bots have no use for coins.');
    return;
  }

  if (!value) {
    await say(record.wallet === 0 ? 'your wallet is empty.' : 'usage — `,pay @user <amount>`');
    return;
  }

  if (value > record.wallet) {
    await say(`you only have **${money(record.wallet)}** ${currency} on you.`);
    return;
  }

  await update(message.author.id, (row) => {
    row.wallet -= value;
    return row;
  }, message.author.username);

  await update(target.id, (row) => {
    row.wallet += value;
    return row;
  }, target.username);

  await say(`paid **${money(value)}** ${currency} to **${target.username}**`);
}
