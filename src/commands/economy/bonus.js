import { bad, coin, good, left, short, update } from '../../lib/economy.js';

/** `,bonus` — 150 every twelve hours. */

export const name = 'bonus';

const every = 12 * 60 * 60 * 1000;
const reward = 150;

export async function prefix(message) {
  const tag = `<@${message.author.id}>`;
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
    embeds: [
      claimed
        ? good(`${tag}: you claimed your bonus of ${coin} ${short(reward)}!`)
        : bad(`${tag}: next bonus in ${left(waited)}.`),
    ],
    allowedMentions: { parse: [] },
  });
}
