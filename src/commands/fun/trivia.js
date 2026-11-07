import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { categories, questions } from '../../lib/trivia-questions.js';
import { addPoint, board, total } from '../../lib/trivia.js';

/**
 * trivia, carried over from labubu: fifteen seconds, the same embed, ❓ and 📊
 * underneath, and points kept per server.
 */

export const name = 'trivia';
export const names = ['triv'];

const window = 15_000;

/** channel id → the question in play, so a channel cannot run two. */
const active = new Map();

const lock = (row) => new ActionRowBuilder().addComponents(
  row.components.map((button) => ButtonBuilder.from(button).setDisabled(true)),
);

const hintFor = (answer) => `${answer[0].toUpperCase()}${'*'.repeat(Math.max(0, answer.length - 1))} (${answer.length} letters)`;

async function leaderboard(guild) {
  const top = await board(guild.id, 10);
  const count = await total(guild.id);

  return new EmbedBuilder()
    .setTitle('🧠 Trivia Leaderboard')
    .setDescription(top.map((player, index) => `${index + 1}. ${player.username ?? player.userId} — **${player.score}** pts`).join('\n'))
    .setColor(0x5865F2)
    .setFooter({ text: `Page 1/${Math.max(1, Math.ceil(count / 10))}` });
}

export async function prefix(message, args) {
  const channelId = message.channel.id;

  if (active.has(channelId)) {
    await message.channel.send('❌ A trivia game is already running in this channel!');
    return;
  }

  let pool = questions;
  let categoryLabel = 'All Categories';

  if (args.length > 0) {
    const input = args.join(' ').toLowerCase();
    const matched = categories[input];

    if (matched) {
      pool = questions.filter((question) => question.category === matched);
      categoryLabel = matched;
    }
  }

  const q = pool[Math.floor(Math.random() * pool.length)];

  const embed = new EmbedBuilder()
    .setTitle('🧠 Trivia Time!')
    .setDescription(`**${q.q}**\n\nType your answer in chat! You have **15 seconds**.`)
    .setColor(0x5865F2)
    .setFooter({ text: `${q.category} • ${categoryLabel !== q.category ? categoryLabel : 'All Categories'}` })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`trivia_hint_${channelId}`).setEmoji('❓').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`trivia_lb_${channelId}`).setEmoji('📊').setStyle(ButtonStyle.Secondary),
  );

  const gameMsg = await message.reply({ embeds: [embed], components: [row] });
  active.set(channelId, { q, gameMsg });

  const guesses = message.channel.createMessageCollector({
    filter: (candidate) => !candidate.author.bot,
    time: window,
  });

  guesses.on('collect', async (candidate) => {
    const guess = candidate.content.trim().toLowerCase();
    const correct = q.a.split('|').some((answer) => guess.includes(answer.trim()));
    if (!correct) return;

    guesses.stop('correct');
    active.delete(channelId);

    await addPoint(message.guild.id, candidate.author.id, candidate.author.username).catch(() => {});
    await gameMsg.edit({ components: [lock(row)] }).catch(() => {});
    await message.channel.send(`✅ **${candidate.author.username}** got it! The answer was **${q.a}** — +1 point!`);
  });

  guesses.on('end', async (_collected, reason) => {
    if (reason === 'correct') return;

    active.delete(channelId);
    await gameMsg.edit({ components: [lock(row)] }).catch(() => {});
    await message.channel.send(`⏰ ${message.author} Time's up! The correct answer was: **${q.a}**`);
  });

  const presses = gameMsg.createMessageComponentCollector({ time: window + 2_000 });

  presses.on('collect', async (press) => {
    await press.deferUpdate();

    if (press.customId === `trivia_hint_${channelId}`) {
      await message.channel.send(`🔵 **${press.user.username}** requested a hint:\nHint: \`${hintFor(q.a)}\``);
      return;
    }

    const top = await board(message.guild.id, 10);

    if (!top.length) {
      await message.channel.send('No trivia scores yet!');
      return;
    }

    await message.channel.send({ embeds: [await leaderboard(message.guild)] });
  });
}
