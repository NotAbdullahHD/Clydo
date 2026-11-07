import { bad, coin, good, left, short, update } from '../../lib/economy.js';

/** `,daily` — 200 a day, plus 25 for each day of streak, capped at 350. */

export const name = 'daily';

const every = 24 * 60 * 60 * 1000;
const grace = 48 * 60 * 60 * 1000;
const base = 200;
const step = 25;
const ceiling = 6;

export async function prefix(message) {
  const tag = `<@${message.author.id}>`;
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
    embeds: [
      waited > 0
        ? bad(`${tag}: already claimed — come back in ${left(waited)}.`)
        : good(`${tag}: you claimed your daily reward of ${coin} ${short(reward)}!`),
    ],
    allowedMentions: { parse: [] },
  });
}
