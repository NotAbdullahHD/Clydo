import { bad, coin, good, left, short, update } from '../../lib/economy.js';

/** `,work` — once an hour, 25 to 60. */

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
  const tag = `<@${message.author.id}>`;
  const now = Date.now();
  let earned = 0;
  let job = null;
  let waited = 0;

  await update(message.author.id, (row) => {
    waited = row.work.at + every - now;
    if (waited > 0) return row;

    job = jobs[Math.floor(Math.random() * jobs.length)];
    earned = 25 + Math.floor(Math.random() * 36);

    row.wallet += earned;
    row.work.at = now;

    return row;
  }, message.author.username);

  await message.reply({
    embeds: [
      waited > 0
        ? bad(`${tag}: still on shift — ${left(waited)} left.`)
        : good(`${tag}: worked as a ${job} and earned ${coin} ${short(earned)}.`),
    ],
    allowedMentions: { parse: [] },
  });
}
