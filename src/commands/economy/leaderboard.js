import { open as pager } from '../../lib/pager.js';
import { short, top } from '../../lib/economy.js';
import { glyphs } from '../../lib/theme.js';

/** `,lb` — the richest, ten a page. */

export const name = 'leaderboard';
export const names = ['lb', 'rich', 'top'];

const pageSize = 10;
const depth = 500;
const medals = glyphs.medals;

export async function prefix(message) {
  const ranked = await top(depth);
  const pages = [];

  for (let offset = 0; offset < ranked.length; offset += pageSize) {
    pages.push(ranked.slice(offset, offset + pageSize).map((row, index) => {
      const rank = offset + index + 1;
      return `${medals[rank - 1] ?? `\`${rank}.\``} <@${row.userId}> — **${short(row.total)}**`;
    }));
  }

  await pager(message, {
    title: 'economy leaderboard',
    note: 'wallet and bank together',
    pages,
    empty: 'nobody has any orbs yet.',
  });
}
