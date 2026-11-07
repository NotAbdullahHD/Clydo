import { bad, coin, good, left, short, update } from '../../lib/economy.js';

/** `,beg` — every five minutes, and usually nothing. */

export const name = 'beg';

const every = 5 * 60 * 1000;

export async function prefix(message) {
  const tag = `<@${message.author.id}>`;
  const now = Date.now();
  let earned = 0;
  let waited = 0;
  let lucky = false;

  await update(message.author.id, (row) => {
    waited = row.beg.at + every - now;
    if (waited > 0) return row;

    row.beg.at = now;

    if (Math.random() >= 0.5) return row;

    lucky = true;
    earned = 5 + Math.floor(Math.random() * 11);
    row.wallet += earned;

    return row;
  }, message.author.username);

  let text;

  if (waited > 0) text = bad(`${tag}: give it a rest — ${left(waited)}.`);
  else if (lucky) text = good(`${tag}: someone handed you ${coin} ${short(earned)}.`);
  else text = bad(`${tag}: nobody looked.`);

  await message.reply({ embeds: [text], allowedMentions: { parse: [] } });
}
