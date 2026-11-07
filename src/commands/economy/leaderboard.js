import { card, coin, short, top } from '../../lib/economy.js';

/** `,lb` — the ten richest, medal for the top three. */

export const name = 'leaderboard';
export const names = ['lb', 'rich', 'top'];

const shown = 10;
const medals = ['🥇', '🥈', '🥉'];

export async function prefix(message) {
  const ranked = await top(shown);

  const lines = ranked.map((row, index) => {
    const mark = medals[index] ?? `${index + 1}.`;
    return `${mark} <@${row.userId}> — ${coin} ${short(row.total)}`;
  });

  await message.reply({
    embeds: [card('🏆 economy leaderboard', lines.length ? lines.join('\n') : 'nobody has any coins yet.')],
    allowedMentions: { parse: [] },
  });
}
