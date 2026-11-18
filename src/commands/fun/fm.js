import { AttachmentBuilder } from 'discord.js';
import { heading, payload, quiet, rule, shell, text } from '../../lib/card.js';
import { collage } from '../../lib/collage.js';
import { accent } from '../../lib/paint.js';
import {
  artistPlays,
  configured,
  defaultTemplate,
  getUser,
  recent,
  setStyle,
  setUser,
  style,
  topAlbums,
  variables,
} from '../../lib/lastfm.js';
import { no, ok } from '../../lib/line.js';
import { palette } from '../../lib/theme.js';

/**
 * `,fm [@user]` — what somebody is playing, and `,fm set|template|react` for the card.
 */

export const name = 'fm';
export const names = ['nowplaying', 'np'];

const fill = (template, fields) => template.replace(
  /\{(track|artist|album|plays|user|url|playing)\}/gi,
  (whole, key) => fields[key.toLowerCase()] ?? whole,
);

export async function prefix(message, args) {
  const head = args[0]?.toLowerCase();

  if (head === 'chart' || head === 'collage') {
    await chart(message, args.slice(1));
    return;
  }

  if (head === 'set') {
    const username = args[1]?.trim();
    if (!username) {
      await message.reply(no('usage: `,fm set <last.fm username>`'));
      return;
    }

    await setUser(message.author.id, username);
    await message.reply(ok(message, `last.fm is **${username}** now.`));
    return;
  }

  if (head === 'template') {
    const wanted = args.slice(1).join(' ').trim();

    if (!wanted) {
      const current = style(message.author.id);
      await message.reply({
        embeds: [{
          color: palette.panel,
          title: 'fm template',
          description: `\`${current.template.replace(/\n/g, '\\n')}\`\n\n-# variables: ${variables.join('  ')}`,
        }],
      });
      return;
    }

    if (wanted.toLowerCase() === 'reset') {
      setStyle(message.author.id, { template: defaultTemplate });
      await message.reply(ok(message, 'layout back to the default.'));
      return;
    }

    setStyle(message.author.id, { template: wanted.slice(0, 500) });
    await message.reply(ok(message, 'layout saved. it applies to your next card.'));
    return;
  }

  if (head === 'react' || head === 'reactions') {
    const wanted = args.slice(1);

    if (!wanted.length) {
      const current = style(message.author.id).reactions;
      await message.reply(current.length
        ? ok(message, `your card reacts with ${current.join(' ')}.`)
        : no('no reactions set — `,fm react 🔥 💀`'));
      return;
    }

    if (wanted[0].toLowerCase() === 'clear') {
      setStyle(message.author.id, { reactions: [] });
      await message.reply(ok(message, 'reactions cleared.'));
      return;
    }

    const reactions = wanted.slice(0, 5);
    setStyle(message.author.id, { reactions });

    await message.reply(ok(message, `your card will react with ${reactions.join(' ')}.`));
    return;
  }

  if (!configured()) {
    await message.reply(no('last.fm is not set up — the owner needs `LASTFM_API_KEY`.'));
    return;
  }

  const target = message.mentions.users.first() ?? message.author;
  const username = await getUser(target.id);

  if (!username) {
    await message.reply(target.id === message.author.id
      ? no('you have no username yet — `,fm set <name>`')
      : no(`${target.username} has not set a last.fm username.`));
    return;
  }

  const track = await recent(username).catch((error) => ({ error: error.message }));

  if (!track || track.error) {
    await message.reply(no(track?.error ?? 'nothing scrobbled yet.'));
    return;
  }

  const plays = await artistPlays(username, track.artist).then((found) => found.plays).catch(() => null);
  const layout = style(target.id);

  const fields = {
    track: track.track,
    artist: track.artist,
    album: track.album || 'single',
    plays: plays === null ? '—' : plays.toLocaleString('en-US'),
    user: username,
    url: track.url ?? `https://www.last.fm/user/${username}`,
    playing: track.playing ? 'now playing' : 'last played',
  };

  const box = shell(await accent({ guildId: message.guildId, userId: target.id, member: message.guild.members.cache.get(target.id) }));
  heading(box, { title: `${username}`, note: fields.playing, avatar: track.art ?? null });
  box.addSeparatorComponents(rule());
  box.addTextDisplayComponents(text(fill(layout.template, fields)));
  box.addTextDisplayComponents(quiet(`artist plays ${fields.plays}`));

  const sent = await message.reply({ ...payload(box), allowedMentions: { parse: [] } }).catch(() => null);

  if (sent && target.id === message.author.id && layout.reactions.length) {
    for (const reaction of layout.reactions) {
      await sent.react(reaction).catch(() => {});
    }
  }

  if (!sent) await message.reply(no('i could not post that card here.'));
}

/** `,fm chart [3|4|5] [week|month|all]` — the top albums as a grid. */
async function chart(message, args) {
  if (!configured()) {
    await message.reply(no('last.fm is not set up — the owner needs `LASTFM_API_KEY`.'));
    return;
  }

  const username = await getUser(message.author.id);

  if (!username) {
    await message.reply(no('you have no username yet — `,fm set <name>`'));
    return;
  }

  const across = [3, 4, 5].includes(Number(args[0])) ? Number(args[0]) : 3;
  const periods = { week: '7day', month: '1month', all: 'overall' };
  const chosen = args.map((arg) => arg.toLowerCase()).find((arg) => arg in periods) ?? 'week';

  await message.channel.sendTyping().catch(() => {});

  const albums = await topAlbums(username, periods[chosen], across * across).catch(() => []);

  if (!albums.length) {
    await message.reply(no('nothing scrobbled in that window.'));
    return;
  }

  const png = await collage({
    albums,
    size: across,
    heading: `${username} · ${chosen} · ${albums.length} albums`,
  });

  await message.reply({
    content: `-# ${username} — top albums, ${chosen}`,
    files: [new AttachmentBuilder(png, { name: 'chart.png' })],
    allowedMentions: { parse: [] },
  });
}
