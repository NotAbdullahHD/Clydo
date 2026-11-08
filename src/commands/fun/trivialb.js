import { open as pager } from '../../lib/pager.js';
import { board, total } from '../../lib/trivia.js';

/** trivia leaderboard, ten a page — the shared pager does the buttons. */

export const name = 'trivialb';
export const names = ['triviaboard', 'trivialeaderboard'];

const pageSize = 10;
const medals = ['🥇', '🥈', '🥉'];

export async function prefix(message) {
  const count = await total(message.guild.id);
  const pages = [];

  for (let offset = 0; offset < count; offset += pageSize) {
    const entries = await board(message.guild.id, pageSize, offset);
    if (!entries.length) break;

    pages.push(entries.map((entry, index) => {
      const rank = offset + index + 1;
      return `${medals[rank - 1] ?? `\`${rank}.\``} ${entry.username ?? entry.userId} — **${entry.score}** pts`;
    }));
  }

  await pager(message, {
    title: 'trivia leaderboard',
    note: `${count} player${count === 1 ? '' : 's'}`,
    pages,
    empty: 'no scores yet — start a game with `,trivia`.',
  });
}
