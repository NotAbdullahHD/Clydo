import { configured, crown, everyone, rememberCrown, topArtist } from '../../lib/lastfm.js';
import { heading, listing, payload, quiet, rule, shell } from '../../lib/card.js';
import { open as pager } from '../../lib/pager.js';
import { no } from '../../lib/line.js';
import { glyphs, palette } from '../../lib/theme.js';

/**
 * `,crowns [refresh]` — the artist each member listens to most, and who holds it.
 */

export const name = 'crowns';
export const names = ['crown'];

const depth = 12;
const pageSize = 8;

export async function prefix(message, args) {
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

  const refresh = args[0]?.toLowerCase() === 'refresh';

  if (refresh) await message.channel.sendTyping().catch(() => {});

  const rows = [];

  for (const person of known) {
    let held = crown(person.user_id);

    if (!held || refresh) {
      const top = await topArtist(person.username).catch(() => null);
      if (top) held = rememberCrown(person.user_id, top);
    }

    if (held) rows.push({ ...held, userId: person.user_id });
  }

  if (!rows.length) {
    await message.reply(no('no crowns yet — `,crowns refresh` asks last.fm once.'));
    return;
  }

  rows.sort((left, right) => right.plays - left.plays);

  if (rows.length <= pageSize) {
    const box = shell(palette.accent);
    heading(box, { title: 'crowns', note: 'most-played artist per member' });
    box.addSeparatorComponents(rule());
    box.addTextDisplayComponents(listing(rows.map((row) => (
      `${glyphs.crown} <@${row.userId}>  —  **${row.artist}**  ·  ${row.plays.toLocaleString('en-US')} plays`
    ))));
    box.addTextDisplayComponents(quiet('cached for twelve hours'));

    await message.reply({ ...payload(box), allowedMentions: { parse: [] } });
    return;
  }

  const pages = [];

  for (let offset = 0; offset < rows.length; offset += pageSize) {
    pages.push(rows.slice(offset, offset + pageSize).map((row) => (
      `${glyphs.crown} <@${row.userId}>  —  **${row.artist}**  ·  ${row.plays.toLocaleString('en-US')} plays`
    )));
  }

  await pager(message, { title: 'crowns', note: 'most-played artist per member', pages });
}
