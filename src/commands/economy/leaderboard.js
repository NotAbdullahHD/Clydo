import { currency, money, top } from '../../lib/economy.js';
import { block, panel } from '../../lib/theme.js';

/** `,lb` — the ten richest wallets, one line each. */

export const name = 'leaderboard';
export const names = ['lb', 'rich', 'top'];

const shown = 10;

export async function prefix(message) {
  const ranked = await top(shown);

  const description = ranked.length
    ? block(...ranked.map((row, index) => {
      const name = message.guild.members.cache.get(row.userId)?.user.username
        ?? row.name
        ?? `<@${row.userId}>`;

      return `**${index + 1}.** ${name} — ${money(row.total)} ${currency}`;
    }))
    : 'nobody has any coins yet.';

  await message.reply({
    embeds: [panel({ title: 'leaderboard', description })],
    allowedMentions: { parse: [] },
  });
}
