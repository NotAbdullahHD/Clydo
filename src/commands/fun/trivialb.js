import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { board, total } from '../../lib/trivia.js';
import { palette } from '../../lib/theme.js';

/** trivia leaderboard, ten a page, ← → under it, medals on the top three. */

export const name = 'trivialb';
export const names = ['triviaboard', 'trivialeaderboard'];

const pageSize = 10;
const medals = ['🥇', '🥈', '🥉'];

async function view(guild, index, pages) {
  const entries = await board(guild.id, pageSize, index * pageSize);

  if (!entries.length) {
    return new EmbedBuilder()
      .setColor(palette.panel)
      .setAuthor({ name: `${guild.name} — Trivia Leaderboard`, iconURL: guild.iconURL() ?? undefined })
      .setDescription('No scores yet. Start a game with `,trivia`');
  }

  const list = entries
    .map((entry, offset) => {
      const rank = index * pageSize + offset + 1;
      return `${medals[rank - 1] ?? `\`${rank}.\``} ${entry.username ?? entry.userId} — **${entry.score}** pts`;
    })
    .join('\n');

  return new EmbedBuilder()
    .setColor(palette.panel)
    .setAuthor({ name: `${guild.name} — Trivia Leaderboard`, iconURL: guild.iconURL() ?? undefined })
    .setDescription(list)
    .setFooter({ text: `Page ${index + 1} of ${pages}` });
}

const row = (index, pages, disabled = false) => new ActionRowBuilder().addComponents(
  new ButtonBuilder().setCustomId('tlb_prev').setLabel('←').setStyle(ButtonStyle.Secondary).setDisabled(disabled || index === 0),
  new ButtonBuilder().setCustomId('tlb_next').setLabel('→').setStyle(ButtonStyle.Secondary).setDisabled(disabled || index >= pages - 1),
);

export async function prefix(message) {
  const count = await total(message.guild.id);
  const pages = Math.max(1, Math.ceil(count / pageSize));
  let index = 0;

  const sent = await message.reply({
    embeds: [await view(message.guild, index, pages)],
    components: pages > 1 ? [row(index, pages)] : [],
  });

  if (pages <= 1) return;

  const collector = sent.createMessageComponentCollector({
    filter: (press) => press.user.id === message.author.id,
    time: 60_000,
  });

  collector.on('collect', async (press) => {
    if (press.customId === 'tlb_prev' && index > 0) index -= 1;
    if (press.customId === 'tlb_next' && index < pages - 1) index += 1;

    await press.update({ embeds: [await view(message.guild, index, pages)], components: [row(index, pages)] });
  });

  collector.on('end', () => sent.edit({ components: [] }).catch(() => {}));
}
