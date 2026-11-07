import { card, get } from '../../lib/economy.js';
import { find } from '../../lib/items.js';

/** `,inv [@user]` — what they own, one item per line. */

export const name = 'inventory';
export const names = ['inv', 'items'];

export async function prefix(message) {
  const target = message.mentions.users.first() ?? message.author;
  const record = await get(target.id);

  const owned = Object.entries(record.inventory)
    .filter(([, count]) => count > 0)
    .map(([id, count]) => `${find(id)?.name ?? id} x${count}`);

  await message.reply({
    embeds: [card(`${target.username}'s inventory`, owned.length ? owned.join('\n') : 'nothing yet.')],
    allowedMentions: { parse: [] },
  });
}
