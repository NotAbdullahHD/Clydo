import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';

/**
 * google search and image search through serpapi, carried over from labubu:
 * ten results, one per page, ◀ ▶ ✖ underneath, and the same embeds.
 */

export const name = 'google';
export const names = ['search', 'g', 'gi'];

const endpoint = 'https://serpapi.com/search.json';

const failure = (text) => ({ embeds: [new EmbedBuilder().setColor(0xED4245).setDescription(text)] });

const page = (index, total, disabled = false) => new ActionRowBuilder().addComponents(
  new ButtonBuilder().setCustomId('gsearch_prev').setEmoji('◀').setStyle(ButtonStyle.Primary).setDisabled(disabled || index === 0),
  new ButtonBuilder().setCustomId('gsearch_next').setEmoji('▶').setStyle(ButtonStyle.Primary).setDisabled(disabled || index >= total - 1),
  new ButtonBuilder().setCustomId('gsearch_close').setEmoji('✖').setStyle(ButtonStyle.Danger).setDisabled(disabled),
);

/** shared by `,google` and `,image` — the only difference is the engine. */
export async function search(message, args, type = 'web') {
  if (!args.length) {
    await message.reply(failure('❌ Usage: `,google <query>` or `,image <query>`'));
    return;
  }

  const apiKey = process.env.SERPAPI_KEY?.trim();

  if (!apiKey) {
    await message.reply(failure('❌ Search not configured. Ask the bot owner to add `SERPAPI_KEY`.'));
    return;
  }

  const query = args.join(' ');
  await message.channel.sendTyping().catch(() => {});

  try {
    const params = new URLSearchParams({
      q: query,
      api_key: apiKey,
      engine: type === 'image' ? 'google_images' : 'google',
      safe: 'active',
      num: '10',
    });

    const response = await fetch(`${endpoint}?${params}`);
    const data = await response.json();

    if (data.error) {
      await message.reply(failure(`❌ Search error: \`${data.error}\``));
      return;
    }

    const items = type === 'image' ? data.images_results : data.organic_results;

    if (!items?.length) {
      await message.reply({
        embeds: [new EmbedBuilder().setColor(0xFEE75C).setDescription(`🔍 No results found for **${query}**`)],
      });
      return;
    }

    let index = 0;
    const total = Math.min(items.length, 10);

    const view = (position) => {
      const item = items[position];
      const domain = (item.link ?? '').replace(/https?:\/\/(www\.)?/, '').split('/')[0];

      const embed = new EmbedBuilder()
        .setAuthor({ name: message.author.username, iconURL: message.author.displayAvatarURL() })
        .setColor(0x8d7bb4)
        .setFooter({
          text: `Page ${position + 1}/${total} of Google ${type === 'image' ? 'Images' : 'Search'} (Safe Mode)`,
          iconURL: 'https://www.google.com/favicon.ico',
        });

      if (type === 'image') {
        embed.setTitle((item.title || 'Image result').slice(0, 100));

        const source = item.original || item.thumbnail;
        if (source) embed.setImage(source);
        if (domain) embed.setDescription(`[${domain}](${item.link})`);

        return embed;
      }

      embed
        .setTitle((item.title || 'No title').slice(0, 80))
        .setDescription(`${(item.snippet || 'No description').slice(0, 300)}\n\n\`${domain}\``);

      if (item.link) embed.setURL(item.link);
      if (item.thumbnail) embed.setThumbnail(item.thumbnail);

      return embed;
    };

    const reply = await message.reply({ embeds: [view(index)], components: [page(index, total)] });

    const collector = reply.createMessageComponentCollector({
      filter: (press) => press.user.id === message.author.id,
      time: 120_000,
    });

    collector.on('collect', async (press) => {
      if (press.customId === 'gsearch_prev' && index > 0) index -= 1;
      else if (press.customId === 'gsearch_next' && index < total - 1) index += 1;
      else if (press.customId === 'gsearch_close') {
        collector.stop('closed');
        await reply.delete().catch(() => {});
        return;
      }

      await press.update({ embeds: [view(index)], components: [page(index, total)] }).catch(() => {});
    });

    collector.on('end', (_collected, reason) => {
      if (reason === 'closed') return;
      reply.edit({ components: [page(index, total, true)] }).catch(() => {});
    });
  } catch (error) {
    await message.reply(failure(`❌ Error: \`${error.message}\``));
  }
}

export async function prefix(message, args) {
  await search(message, args, 'web');
}
