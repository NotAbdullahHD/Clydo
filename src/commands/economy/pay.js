import { amount, bad, coin, get, good, short, update } from '../../lib/economy.js';

/** `,pay @user <amount>` — wallet to wallet. */

export const name = 'pay';
export const names = ['give'];

export async function prefix(message, args) {
  const tag = `<@${message.author.id}>`;
  const target = message.mentions.users.first();
  const record = await get(message.author.id);
  const value = amount(args.find((arg) => /^[\d,_]+$/.test(arg) || arg.toLowerCase() === 'all'), record.wallet);

  const reply = (embed) => message.reply({ embeds: [embed], allowedMentions: { parse: [] } });

  if (!target) {
    await reply(bad(`${tag}: usage — \`,pay @user <amount>\``));
    return;
  }

  if (target.id === message.author.id) {
    await reply(bad(`${tag}: paying yourself does nothing.`));
    return;
  }

  if (target.bot) {
    await reply(bad(`${tag}: bots have no use for coins.`));
    return;
  }

  if (!value) {
    await reply(bad(record.wallet === 0
      ? `${tag}: your wallet is empty.`
      : `${tag}: usage — \`,pay @user <amount>\``));
    return;
  }

  if (value > record.wallet) {
    await reply(bad(`${tag}: you only have ${coin} ${short(record.wallet)} on you.`));
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

  await reply(good(`${tag}: paid ${coin} ${short(value)} to <@${target.id}>.`));
}
