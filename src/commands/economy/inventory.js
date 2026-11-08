import { get } from '../../lib/economy.js';
import { find } from '../../lib/items.js';
import { open as pager } from '../../lib/pager.js';

/** `,inv [@user]` — what they own, eight a page. */

export const name = 'inventory';
export const names = ['inv', 'items'];

const pageSize = 8;

export async function prefix(message) {
  const target = message.mentions.users.first() ?? message.author;
  const record = await get(target.id);

  const lines = Object.entries(record.inventory)
    .filter(([, count]) => count > 0)
    .map(([id, count]) => `\`›\` ${find(id)?.name ?? id}  —  **x${count}**`);

  const pages = [];

  for (let offset = 0; offset < lines.length; offset += pageSize) {
    pages.push(lines.slice(offset, offset + pageSize));
  }

  await pager(message, {
    title: `${target.username}'s inventory`,
    note: `${lines.length} item${lines.length === 1 ? '' : 's'}`,
    pages,
    empty: 'nothing yet.',
  });
}
