import { EmbedBuilder } from 'discord.js';
import { getUser, setUser } from '../../lib/lastfm.js';

/**
 * last.fm now playing, carried over from labubu with the same embed: the album
 * art as thumbnail and a green panel while a track is actually scrobbling.
 */

export const name = 'fm';

const endpoint = 'https://ws.audioscrobbler.com/2.0/';

export async function prefix(message, args) {
  const sub = args[0]?.toLowerCase();

  if (sub === 'set') {
    const username = args[1];

    if (!username) {
      await message.reply('❌ Usage: `,fm set <your_lastfm_username>`');
      return;
    }

    await setUser(message.author.id, username);
    await message.reply(`✅ Last.fm username set to: **${username}**`);
    return;
  }

  const key = process.env.LASTFM_API_KEY?.trim();

  if (!key) {
    await message.reply('❌ Last.fm not configured. Ask the bot owner to add `LASTFM_API_KEY`.');
    return;
  }

  const saved = await getUser(message.author.id);

  if (!saved) {
    await message.reply('❌ You haven\'t set your username! Use `,fm set <name>`');
    return;
  }

  try {
    const params = new URLSearchParams({
      method: 'user.getrecenttracks',
      user: saved,
      api_key: key,
      format: 'json',
      limit: '1',
    });

    const response = await fetch(`${endpoint}?${params}`);
    const data = await response.json();
    const track = data?.recenttracks?.track?.[0];

    if (!track) {
      await message.reply('❌ No recent tracks found.');
      return;
    }

    const playing = track['@attr']?.nowplaying === 'true';
    const art = track.image?.[2]?.['#text'];

    const embed = new EmbedBuilder()
      .setColor(0x8d7bb4)
      .setAuthor({ name: `Last.fm: ${saved}`, iconURL: message.author.displayAvatarURL() })
      .setTitle(`🎵 ${track.name}`)
      .setDescription(`**Artist:** ${track.artist['#text']}\n**Album:** ${track.album['#text']}`)
      .setFooter({ text: playing ? 'Now Playing...' : 'Last scrobbled' });

    if (art) embed.setThumbnail(art);

    await message.reply({ embeds: [embed] });
  } catch (error) {
    console.warn('[slink] last.fm lookup failed —', error?.message ?? error);
    await message.reply('❌ Error talking to Last.fm.');
  }
}
