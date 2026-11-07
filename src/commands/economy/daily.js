import { currency, left, money, update } from '../../lib/economy.js';
import { panel } from '../../lib/theme.js';

/** `,daily` — once a day, with a streak that keeps growing while you keep it. */

export const name = 'daily';

const every = 24 * 60 * 60 * 1000;
const grace = 48 * 60 * 60 * 1000;
const base = 500;
const step = 100;
const ceiling = 6;

export async function prefix(message) {
  const now = Date.now();
  let reward = 0;
  let streak = 0;
  let waited = 0;

  await update(message.author.id, (row) => {
    waited = row.daily.at + every - now;

    if (waited > 0) return row;

    streak = row.daily.at > 0 && now - row.daily.at < grace ? row.daily.streak + 1 : 1;
    reward = base + Math.min(streak - 1, ceiling) * step;

    row.wallet += reward;
    row.daily = { at: now, streak };

    return row;
  }, message.author.username);

  await message.reply({
    embeds: [panel({
      title: 'daily',
      description: waited > 0
        ? `already claimed — come back in **${left(waited)}**`
        : `claimed **${money(reward)}** ${currency} — day ${streak} streak`,
    })],
  });
}
