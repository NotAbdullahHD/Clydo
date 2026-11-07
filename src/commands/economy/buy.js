import { currency, get, money, update } from '../../lib/economy.js';
import { find } from '../../lib/items.js';
import { panel } from '../../lib/theme.js';

/** `,buy <item>` — wallet only, one at a time. */

export const name = 'buy';

export async function prefix(message, args) {
  const item = find(args.join(' '));
  const say = (description) => message.reply({
    embeds: [panel({ title: 'buy', description })],
  });

  if (!item) {
    await say('no such item — `,shop`');
    return;
  }

  const record = await get(message.author.id);

  if (record.wallet < item.price) {
    await say(`**${item.name}** costs **${money(item.price)}** ${currency} — you have **${money(record.wallet)}**.`);
    return;
  }

  await update(message.author.id, (row) => {
    row.wallet -= item.price;
    row.inventory[item.id] = (row.inventory[item.id] ?? 0) + 1;
    return row;
  }, message.author.username);

  await say(`bought **${item.name}** for **${money(item.price)}** ${currency}`);
}
