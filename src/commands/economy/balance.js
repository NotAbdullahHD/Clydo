import { currency, get, money, total } from '../../lib/economy.js';
import { block, datapoint, panel } from '../../lib/theme.js';

/** `,balance [@user]` — wallet, bank, total. three lines, nothing else. */

export const name = 'balance';
export const names = ['bal'];

export async function prefix(message) {
  const target = message.mentions.users.first() ?? message.author;
  const record = await get(target.id);

  await message.reply({
    embeds: [panel({
      title: target.id === message.author.id ? 'balance' : `${target.username}'s balance`,
      description: block(
        datapoint('wallet', money(record.wallet)),
        datapoint('bank', money(record.bank)),
        datapoint('total', `**${money(total(record))}** ${currency}`),
      ),
    })],
    allowedMentions: { parse: [] },
  });
}
