import { artistPlays, configured, everyone, getUser, recent } from '../../lib/lastfm.js';
import { heading, listing, payload, quiet, rule, shell } from '../../lib/card.js';
import { no } from '../../lib/line.js';
import { glyphs, palette } from '../../lib/theme.js';

/**
 * `,wk [artist|@user]` — the server's listeners of one artist, most plays first.
 *
 * fmbot asks for the artist every time; here it defaults to whatever you (or the
 * person you mention) scrobbled last, so a bare `,wk` is the usual call and the
 * artist name is only the fallback.
 */

export const name = 'whoknows';
export const names = ['wk'];

const depth = 12;

const mentionOnly = (part) => /^<@!?\d+>$/.test(part);

export async function prefix(message, args) {
  if (!configured()) {
    await message.reply(no('last.fm is not set up — the owner needs `LASTFM_API_KEY`.'));
    return;
  }

  const mentioned = message.mentions.users.first() ?? null;
  let artist = args.filter((part) => !mentionOnly(part)).join(' ').trim();

  if (!artist) {
    const who = mentioned ?? message.author;
    const username = await getUser(who.id);

    if (!username) {
      await message.reply(no(who.id === message.author.id
        ? 'name an artist — `,wk arctic monkeys` — or link last.fm first with `,fm set <name>`'
        : `${who.username} has not linked a last.fm username.`));
      return;
    }

    const track = await recent(username).catch(() => null);
    artist = track?.artist?.trim() ?? '';

    if (!artist) {
      await message.reply(no(`nothing scrobbled for **${username}** yet — name an artist instead.`));
      return;
    }
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

  const found = await Promise.all(known.map(async (row) => {
    const result = await artistPlays(row.username, artist).catch(() => null);
    return result ? { userId: row.user_id, ...result } : null;
  }));

  const ranked = found
    .filter((row) => row && row.plays > 0)
    .sort((left, right) => right.plays - left.plays);

  const skin = ranked[0] ?? found.find(Boolean) ?? null;
  const title = skin?.name ?? artist;

  if (!ranked.length) {
    await message.reply(no(`nobody here has scrobbled **${title}**.`));
    return;
  }

  const plays = ranked.reduce((sum, row) => sum + row.plays, 0);

  const box = shell(palette.accent);
  heading(box, {
    title,
    note: `${guild.name}  ·  ${ranked.length} listener${ranked.length === 1 ? '' : 's'}`,
    avatar: skin?.art ?? null,
  });
  box.addSeparatorComponents(rule());
  box.addTextDisplayComponents(listing(ranked.map((row, index) => (
    `${glyphs.medals[index] ?? '`›`'} <@${row.userId}>  —  **${row.plays.toLocaleString('en-US')}** plays`
  ))));
  box.addTextDisplayComponents(quiet([
    `${plays.toLocaleString('en-US')} plays across ${ranked.length}`,
    skin?.listeners ? `${skin.listeners.toLocaleString('en-US')} listeners on last.fm` : null,
  ].filter(Boolean).join('  ·  ')));

  await message.reply({ ...payload(box), allowedMentions: { parse: [] } });
}
