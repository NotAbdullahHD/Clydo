import { board, total } from '../../lib/flags.js';
import { open as pager } from '../../lib/pager.js';

/** the flag leaderboard, ten a page — the shared pager does the buttons. */

export const name = 'flaglb';
export const names = ['flagleaderboard', 'flags'];

const pageSize = 10;
const medals = ['🥇', '🥈', '🥉'];

export async function prefix(message) {
  const guildId = message.guild.id;
  const count = await total(guildId);
  const pages = [];

  for (let offset = 0; offset < count; offset += pageSize) {
    const entries = await board(guildId, pageSize, offset);
    if (!entries.length) break;

    pages.push(entries.map((entry, index) => {
      const rank = offset + index + 1;
      return `${medals[rank - 1] ?? `\`${rank}.\``} ${entry.username ?? entry.userId} — **${entry.score}** pts`;
    }));
  }

  await pager(message, {
    title: 'flags leaderboard',
    note: `${count} player${count === 1 ? '' : 's'}`,
    pages,
    empty: 'no scores yet — start a game with `,flag`.',
  });
}
