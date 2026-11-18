import { find } from '../../lib/items.js';
import { coin, get, money, put, total } from '../../lib/economy.js';
import { no, ok } from '../../lib/line.js';

/**
 * `,buy <item>` — spend wallet orbs on a collectible.
 */

export const name = 'buy';

export async function prefix(message, args) {
  const query = args.join(' ').trim();

  if (!query) {
    await message.reply(no('usage: `,buy smooth rock` — `,shop` lists them.'));
    return;
  }

  const item = find(query);

  if (!item) {
    await message.reply(no(`nothing called \`${query}\` — \`,shop\` lists them.`));
    return;
  }

  const record = await get(message.author.id);

  if (total(record) < item.price) {
    await message.reply(no(`**${item.name}** is ${money(item.price)} ${coin} — you have ${money(total(record))}.`));
    return;
  }

  const fromBank = record.wallet < item.price;
  const next = {
    ...record,
    wallet: fromBank ? record.wallet : record.wallet - item.price,
    bank: fromBank ? record.bank - (item.price - record.wallet) : record.bank,
    inventory: {
      ...record.inventory,
      [item.id]: (record.inventory[item.id] ?? 0) + 1,
    },
  };

  await put(next);

  await message.reply(ok(message, `**${item.name}** for ${money(item.price)} ${coin} — *${item.blurb}*`));
}
