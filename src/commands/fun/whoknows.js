import { artistPlays, configured, everyone } from '../../lib/lastfm.js';
import { heading, listing, payload, quiet, rule, shell } from '../../lib/card.js';
import { no } from '../../lib/line.js';
import { palette } from '../../lib/theme.js';

/**
 * `,whoknows <artist>` — the server's listeners of one artist, most plays first.
 */

export const name = 'whoknows';
export const names = ['wk'];

const depth = 12;

export async function prefix(message, args) {
  const artist = args.join(' ').trim();

  if (!artist) {
    await message.reply(no('usage: `,whoknows <artist>`'));
    return;
  }

  if (!configured()) {
    await message.reply(no('last.fm is not set up — the owner needs `LASTFM_API_KEY`.'));
    return;
  }

  const guild = message.guild;
  const known = everyone()
    .filter((row) => guild.members.cache.has(row.user_id))
    .slice(0, depth);

  if (!known.length) {
    await message.reply(no('nobody in this server has linked a last.fm username yet.'));
    return;
  }

  await message.channel.sendTyping().catch(() => {});

  const scored = await Promise.all(known.map(async (row) => {
    const result = await artistPlays(row.username, artist).catch(() => null);
    return result && result.plays > 0
      ? { userId: row.user_id, username: row.username, plays: result.plays }
      : null;
  }));

  const ranked = scored.filter(Boolean).sort((left, right) => right.plays - left.plays);

  if (!ranked.length) {
    await message.reply(no(`nobody here has scrobbled **${artist}**.`));
    return;
  }

  const medal = ['🥇', '🥈', '🥉'];
  const box = shell(palette.accent);
  heading(box, { title: 'whoknows', note: `${artist} · ${ranked.length} listener${ranked.length === 1 ? '' : 's'}` });
  box.addSeparatorComponents(rule());
  box.addTextDisplayComponents(listing(ranked.map((row, index) => (
    `${medal[index] ?? '`›`'} <@${row.userId}>  —  **${row.plays.toLocaleString('en-US')}** plays`
  ))));
  box.addTextDisplayComponents(quiet('plays come from each linked last.fm account'));

  await message.reply({ ...payload(box), allowedMentions: { parse: [] } });
}
