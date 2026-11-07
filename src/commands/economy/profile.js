import { currency, get, money, total } from '../../lib/economy.js';
import { block, datapoint, panel } from '../../lib/theme.js';

/** `,profile [@user]` — the wallet and a little history, still five lines. */

export const name = 'profile';
export const names = ['me'];

export async function prefix(message) {
  const target = message.mentions.users.first() ?? message.author;
  const record = await get(target.id);
  const items = Object.values(record.inventory).reduce((sum, count) => sum + count, 0);

  await message.reply({
    embeds: [panel({
      title: target.id === message.author.id ? 'profile' : `${target.username}'s profile`,
      description: block(
        datapoint('wallet', money(record.wallet)),
        datapoint('bank', money(record.bank)),
        datapoint('total', `**${money(total(record))}** ${currency}`),
        datapoint('daily streak', `day ${record.daily.streak}`),
        datapoint('items', String(items)),
      ),
    })],
    allowedMentions: { parse: [] },
  });
}
