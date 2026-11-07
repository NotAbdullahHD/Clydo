import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { flags } from '../lib/flag-list.js';
import { addPoint, board, total } from '../lib/flags.js';
import { palette } from '../lib/theme.js';

/**
 * guess the flag — kept as labubu had it.
 *
 * the embed is titled "Guess the Flag" with the flag as its thumbnail, the ❓ and
 * 📊 buttons sit underneath, and results go out as plain lines in chat instead of
 * a panel. this game is the one deliberate exception to clydo's no-emoji rule:
 * it is the game people already know.
 */

export const name = 'flag';
export const names = ['flagguess'];

const window = 10_000;

/** channel id → the running round, shared with `,flaghint`. */
export const rounds = new Map();

const iso = (code) => `https://flagcdn.com/w320/${code}.png`;

/** lower-case, punctuation flattened — `sri lanka.` and `Sri  Lanka` match. */
const normalize = (text) => String(text ?? '')
  .toLowerCase()
  .replace(/[^a-z0-9 ]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const answersOf = (flag) => [flag[1], ...(flag[2] ?? [])].map(normalize);

export const hintFor = (country) => {
  const stars = '*'.repeat(Math.max(0, country.length - 2));
  return `${country[0]}${stars}${country.length > 1 ? country[country.length - 1] : ''} (${country.length} letters)`;
};

const medals = ['🥇', '🥈', '🥉'];

const lock = (row) => new ActionRowBuilder().addComponents(
  row.components.map((button) => ButtonBuilder.from(button).setDisabled(true)),
);

export async function leaderboard(guild) {
  const entries = await board(guild.id, 10);
  const count = await total(guild.id);

  const list = entries
    .map((entry, index) => `${medals[index] ?? `\`${index + 1}.\``} ${entry.username ?? entry.userId} — **${entry.score}** pts`)
    .join('\n');

  return new EmbedBuilder()
    .setColor(palette.panel)
    .setTitle(',flags leaderboard')
    .setDescription(`Top flag guessers in the server\n\n${list}`)
    .setFooter({ text: `Page 1/${Math.max(1, Math.ceil(count / 10))}` });
}

export async function prefix(message) {
  const channelId = message.channel.id;

  if (rounds.has(channelId)) {
    await message.reply('❌ A flag game is already running in this channel!');
    return;
  }

  const flag = flags[Math.floor(Math.random() * flags.length)];
  const answers = answersOf(flag);

  const embed = new EmbedBuilder()
    .setTitle('Guess the Flag')
    .setDescription('You have 10 seconds to guess! try `,flaghint`')
    .setThumbnail(iso(flag[0]))
    .setColor(palette.panel);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`flag_hint_${channelId}`).setEmoji('❓').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`flag_lb_${channelId}`).setEmoji('📊').setStyle(ButtonStyle.Secondary),
  );

  const gameMsg = await message.reply({ embeds: [embed], components: [row] });
  rounds.set(channelId, { flag, gameMsg });

  const guesses = message.channel.createMessageCollector({
    filter: (candidate) => !candidate.author.bot && answers.includes(normalize(candidate.content)),
    time: window,
  });

  guesses.on('collect', async (winner) => {
    try {
      guesses.stop('correct');
      rounds.delete(channelId);

      await addPoint(message.guild.id, winner.author.id, winner.author.username).catch(() => {});
      await gameMsg.edit({ components: [lock(row)] }).catch(() => {});

      await message.channel.send(`✅ **${winner.author.username}** got it! The correct answer was: **${flag[1]}**`);
    } catch (error) {
      console.warn('[clydo] flag round skipped —', error?.message ?? error);
    }
  });

  guesses.on('end', async (_collected, reason) => {
    if (reason === 'correct') return;

    try {
      rounds.delete(channelId);
      await gameMsg.edit({ components: [lock(row)] }).catch(() => {});

      await message.channel.send(`⏰ ${message.author} Time's up! The correct answer was: **${flag[1]}**`);
    } catch (error) {
      console.warn('[clydo] flag round skipped —', error?.message ?? error);
    }
  });

  const presses = gameMsg.createMessageComponentCollector({ time: window });

  presses.on('collect', async (press) => {
    try {
      await press.deferUpdate();

      if (press.customId === `flag_hint_${channelId}`) {
        await message.channel.send(`🔵 **${press.user}** requested a hint:\nHint: \`${hintFor(flag[1])}\``);
        return;
      }

      const entries = await board(message.guild.id, 10);

      if (!entries.length) {
        await message.channel.send('No flag scores yet! Be the first to win a round.');
        return;
      }

      await message.channel.send({ embeds: [await leaderboard(message.guild)] });
    } catch (error) {
      console.warn('[clydo] flag button skipped —', error?.message ?? error);
    }
  });
}
