import { get } from '../../lib/economy.js';
import { find } from '../../lib/items.js';
import { block, entry, panel } from '../../lib/theme.js';

/** `,inv [@user]` — what they own, one item per line. */

export const name = 'inventory';
export const names = ['inv', 'items'];

export async function prefix(message) {
  const target = message.mentions.users.first() ?? message.author;
  const record = await get(target.id);

  const owned = Object.entries(record.inventory)
    .map(([id, count]) => [find(id) ?? { name: id }, count])
    .filter(([, count]) => count > 0);

  const description = owned.length
    ? block(...owned.map(([item, count]) => entry(item.name, `x${count}`)))
    : 'nothing yet — `,shop`';

  await message.reply({
    embeds: [panel({
      title: target.id === message.author.id ? 'inventory' : `${target.username}'s inventory`,
      description,
    })],
    allowedMentions: { parse: [] },
  });
}
