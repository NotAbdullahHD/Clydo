import { currency, left, money, update } from '../../lib/economy.js';
import { panel } from '../../lib/theme.js';

/** `,beg` — every two minutes, usually very little. */

export const name = 'beg';

const every = 2 * 60 * 1000;

const luck = [
  'someone dropped **{n}** coins.',
  'a stranger handed you **{n}** coins.',
  'you found **{n}** coins in the sofa.',
  'a passing crow left **{n}** coins. somehow.',
];

export async function prefix(message) {
  const now = Date.now();
  let line = null;
  let waited = 0;

  await update(message.author.id, (row) => {
    waited = row.beg.at + every - now;
    if (waited > 0) return row;

    row.beg.at = now;

    if (Math.random() < 0.4) {
      line = 'nobody looked.';
      return row;
    }

    const earned = 10 + Math.floor(Math.random() * 51);
    row.wallet += earned;
    line = luck[Math.floor(Math.random() * luck.length)].replace('{n}', money(earned));

    return row;
  }, message.author.username);

  await message.reply({
    embeds: [panel({
      title: 'beg',
      description: waited > 0 ? `give it a rest — back in **${left(waited)}**` : line,
    })],
  });
}
