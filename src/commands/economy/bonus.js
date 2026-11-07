import { currency, left, money, update } from '../../lib/economy.js';
import { panel } from '../../lib/theme.js';

/** `,bonus` — a flat top-up every six hours. */

export const name = 'bonus';

const every = 6 * 60 * 60 * 1000;
const reward = 1_000;

export async function prefix(message) {
  const now = Date.now();
  let waited = 0;
  let claimed = false;

  await update(message.author.id, (row) => {
    waited = row.bonus.at + every - now;
    if (waited > 0) return row;

    row.wallet += reward;
    row.bonus.at = now;
    claimed = true;

    return row;
  }, message.author.username);

  await message.reply({
    embeds: [panel({
      title: 'bonus',
      description: claimed
        ? `claimed **${money(reward)}** ${currency}`
        : `already claimed — next one in **${left(waited)}**`,
    })],
  });
}
