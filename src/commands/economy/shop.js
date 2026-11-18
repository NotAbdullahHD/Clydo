import { items } from '../../lib/items.js';
import { coin, money } from '../../lib/economy.js';
import { panel } from '../../lib/theme.js';

/**
 * `,shop` — the catalogue, with what things cost.
 */

export const name = 'shop';
export const names = ['store'];

export async function prefix(message) {
  await message.reply({
    embeds: [panel({
      title: 'shop',
      description: items.map((item) => `\`›\` **${item.name}**  —  ${money(item.price)} ${coin}\n-# ${item.id} · ${item.blurb}`).join('\n'),
      footer: ',buy <item> — everything here is cosmetic',
    })],
    allowedMentions: { parse: [] },
  });
}
