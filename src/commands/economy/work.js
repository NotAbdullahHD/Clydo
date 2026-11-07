import { currency, left, money, update } from '../../lib/economy.js';
import { panel } from '../../lib/theme.js';

/** `,work` — once an hour, a random job and a random wage. */

export const name = 'work';

const every = 60 * 60 * 1000;
const jobs = [
  'night shift stocker',
  'vending machine repair',
  'forum moderator',
  'data entry clerk',
  'bike courier',
  'sound engineer',
  'tutor',
  'barista',
];

export async function prefix(message) {
  const now = Date.now();
  let earned = 0;
  let job = null;
  let waited = 0;

  await update(message.author.id, (row) => {
    waited = row.work.at + every - now;
    if (waited > 0) return row;

    job = jobs[Math.floor(Math.random() * jobs.length)];
    earned = 120 + Math.floor(Math.random() * 201);

    row.wallet += earned;
    row.work.at = now;

    return row;
  }, message.author.username);

  await message.reply({
    embeds: [panel({
      title: 'work',
      description: waited > 0
        ? `you are still on shift — back in **${left(waited)}**`
        : `${job} — earned **${money(earned)}** ${currency}`,
    })],
  });
}
