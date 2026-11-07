import { currency, money } from '../../lib/economy.js';
import { items } from '../../lib/items.js';
import { block, entry, panel } from '../../lib/theme.js';

/** `,shop` — the catalogue, price on every line. */

export const name = 'shop';
export const names = ['store'];

export async function prefix(message) {
  await message.reply({
    embeds: [panel({
      title: 'shop',
      description: block(...items.map((item) => entry(item.name, `${money(item.price)} ${currency}`))),
      footer: 'use ,buy <item> to buy one',
    })],
  });
}
