import { bank, card, coin, get, short } from '../../lib/economy.js';

/** `,balance [@user]` — wallet and bank on one line, like greed's. */

export const name = 'balance';
export const names = ['bal'];

export async function prefix(message) {
  const target = message.mentions.users.first() ?? message.author;
  const record = await get(target.id);

  await message.reply({
    embeds: [card(`${target.username}'s balance`, `${coin} ${short(record.wallet)} • ${bank} ${short(record.bank)}`)],
    allowedMentions: { parse: [] },
  });
}
