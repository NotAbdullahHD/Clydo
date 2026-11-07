import { bank, card, coin, get, short, total } from '../../lib/economy.js';

/** `,profile [@user]` — the pockets, then the streak and item count. */

export const name = 'profile';
export const names = ['me'];

export async function prefix(message) {
  const target = message.mentions.users.first() ?? message.author;
  const record = await get(target.id);
  const items = Object.values(record.inventory).reduce((sum, count) => sum + count, 0);

  await message.reply({
    embeds: [card(
      `${target.username}'s profile`,
      `${coin} ${short(record.wallet)} • ${bank} ${short(record.bank)} • ${short(total(record))} total\n`
      + `daily streak day ${record.daily.streak} • ${items} item${items === 1 ? '' : 's'}`,
    )],
    allowedMentions: { parse: [] },
  });
}
