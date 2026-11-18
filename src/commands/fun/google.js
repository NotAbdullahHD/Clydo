import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { no } from '../../lib/line.js';
import { glyphs, panel, palette } from '../../lib/theme.js';

/**
 * `,google <query>` and `,image <query>` — ten results, one page at a time.
 */

export const name = 'google';
export const names = ['search', 'g'];

const endpoint = 'https://serpapi.com/search.json';

const controls = (at, total, disabled = false) => new ActionRowBuilder().addComponents(
  new ButtonBuilder()
    .setCustomId('search:prev')
    .setEmoji(glyphs.prev)
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(disabled || at === 0),
  new ButtonBuilder()
    .setCustomId('search:next')
    .setEmoji(glyphs.next)
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(disabled || at >= total - 1),
  new ButtonBuilder()
    .setCustomId('search:close')
    .setEmoji(glyphs.trash)
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(disabled),
);

export async function search(message, args, type = 'web') {
  if (!args.length) {
    await message.reply(no(`usage: \`,${type === 'image' ? 'image' : 'google'} <query>\``));
    return;
  }

  const key = process.env.SERPAPI_KEY?.trim();

  if (!key) {
    await message.reply(no('search is not set up — the owner needs `SERPAPI_KEY`.'));
    return;
  }

  const query = args.join(' ');
  await message.channel.sendTyping().catch(() => {});

  const params = new URLSearchParams({
    q: query,
    api_key: key,
    engine: type === 'image' ? 'google_images' : 'google',
    safe: 'active',
    num: '10',
  });

  const data = await fetch(`${endpoint}?${params}`).then((response) => response.json());

  if (data.error) {
    await message.reply(no(`search refused — \`${data.error}\`.`));
    return;
  }

  const items = (type === 'image' ? data.images_results : data.organic_results) ?? [];

  if (!items.length) {
    await message.reply(no(`nothing found for **${query}**.`));
    return;
  }

  const total = Math.min(items.length, 10);
  let at = 0;

  const view = (index) => {
    const item = items[index];
    const domain = (item.link ?? '').replace(/https?:\/\/(www\.)?/, '').split('/')[0];

    if (type === 'image') {
      const embed = panel({
        title: (item.title || 'image result').slice(0, 100),
        description: domain ? `[${domain}](${item.link})` : null,
        footer: `${index + 1}/${total} · safe search`,
        accent: palette.accent,
      });

      const source = item.original || item.thumbnail;
      if (source) embed.setImage(source);

      return embed;
    }

    const embed = panel({
      title: (item.title || 'no title').slice(0, 80),
      description: `${(item.snippet || 'no description').slice(0, 300)}\n\n\`${domain}\``,
      footer: `${index + 1}/${total} · safe search`,
      accent: palette.accent,
    });

    if (item.link) embed.setURL(item.link);
    if (item.thumbnail) embed.setThumbnail(item.thumbnail);

    return embed;
  };

  const sent = await message.reply({ embeds: [view(at)], components: [controls(at, total)] });

  const collector = sent.createMessageComponentCollector({
    filter: (press) => press.user.id === message.author.id,
    time: 120_000,
  });

  collector.on('collect', async (press) => {
    try {
      if (press.customId === 'search:close') {
        collector.stop('closed');
        await sent.delete().catch(() => {});
        return;
      }

      if (press.customId === 'search:prev') at = Math.max(0, at - 1);
      if (press.customId === 'search:next') at = Math.min(total - 1, at + 1);

      await press.update({ embeds: [view(at)], components: [controls(at, total)] });
    } catch (error) {
      console.warn('[slink] search skipped —', error?.message ?? error);
    }
  });

  collector.on('end', (_collected, reason) => {
    if (reason === 'closed') return;
    sent.edit({ components: [controls(at, total, true)] }).catch(() => {});
  });
}

export async function prefix(message, args) {
  await search(message, args, 'web');
}
