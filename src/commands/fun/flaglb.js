import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { board, total } from '../../lib/flags.js';
import { palette } from '../../lib/theme.js';

/** the leaderboard labubu had: ten a page, ← → under it, medals on top three. */

export const name = 'flaglb';
export const names = ['flagleaderboard', 'flags'];

const pageSize = 10;
const medals = ['🥇', '🥈', '🥉'];

async function view(guildId, index, pages) {
  const entries = await board(guildId, pageSize, index * pageSize);

  const list = entries
    .map((entry, offset) => {
      const rank = index * pageSize + offset + 1;
      return `${medals[rank - 1] ?? `\`${rank}.\``} ${entry.username ?? entry.userId} — **${entry.score}** pts`;
    })
    .join('\n');

  return new EmbedBuilder()
    .setColor(palette.panel)
    .setTitle(',flags leaderboard')
    .setDescription(`Top flag guessers in the server\n\n${list}`)
    .setFooter({ text: `Page ${index + 1}/${pages}` });
}

const row = (index, pages, disabled = false) => new ActionRowBuilder().addComponents(
  new ButtonBuilder().setCustomId('flb_prev').setLabel('←').setStyle(ButtonStyle.Secondary).setDisabled(disabled || index === 0),
  new ButtonBuilder().setCustomId('flb_next').setLabel('→').setStyle(ButtonStyle.Secondary).setDisabled(disabled || index >= pages - 1),
);

export async function prefix(message) {
  const guildId = message.guild.id;
  const count = await total(guildId);

  if (!count) {
    await message.reply('No scores yet. Start a game with `,flag`');
    return;
  }

  const pages = Math.ceil(count / pageSize);
  let index = 0;

  const sent = await message.reply({
    embeds: [await view(guildId, index, pages)],
    components: pages > 1 ? [row(index, pages)] : [],
  });

  if (pages <= 1) return;

  const collector = sent.createMessageComponentCollector({
    filter: (press) => press.user.id === message.author.id,
    time: 60_000,
  });

  collector.on('collect', async (press) => {
    if (press.customId === 'flb_prev' && index > 0) index -= 1;
    else if (press.customId === 'flb_next' && index < pages - 1) index += 1;

    await press.update({ embeds: [await view(guildId, index, pages)], components: [row(index, pages)] });
  });

  collector.on('end', () => sent.edit({ components: [row(index, pages, true)] }).catch(() => {}));
}
