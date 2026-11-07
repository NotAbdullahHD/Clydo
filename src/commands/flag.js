import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} from 'discord.js';
import { flags } from '../lib/flag-list.js';
import { addPoint, board } from '../lib/flags.js';
import { prefix as prefixChar } from '../lib/prefix.js';
import { block, datapoint, entry, panel } from '../lib/theme.js';

/**
 * guess the flag — one round, ten seconds, one per channel.
 *
 * the flag is the only image clydo ever shows: it is the question, so there is
 * no way to ask it in type. everything else stays on the usual panel.
 */

export const name = 'flag';

const window = 10_000;

/** channel id → running round id, so two rounds cannot share a channel. */
const running = new Map();

const iso = (code) => `https://flagcdn.com/w320/${code}.png`;

/** lower-case, punctuation flattened — `sri lanka.` and `Sri  Lanka` match. */
const normalize = (text) => String(text ?? '')
  .toLowerCase()
  .replace(/[^a-z0-9 ]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const answersOf = (flag) => [flag[1], ...(flag[2] ?? [])].map(normalize);

const hintFor = (country) => {
  const stars = '*'.repeat(Math.max(0, country.length - 2));
  return `${country[0]}${stars}${country.length > 1 ? country[country.length - 1] : ''} (${country.length} letters)`;
};

const say = (title, description, footer) => ({
  embeds: [panel({ title, description, footer })],
  allowedMentions: { parse: [] },
});

const lock = (row) => new ActionRowBuilder().addComponents(
  row.components.map((button) => ButtonBuilder.from(button).setDisabled(true)),
);

async function leaderboard(guild) {
  const top = await board(guild.id, 10);

  const description = top.length
    ? block(...top.map((player, index) => entry(`${index + 1}`, `${player.username ?? `<@${player.userId}>`} — **${player.score}**`)))
    : 'no rounds won here yet.';

  return panel({ title: 'flag', description, footer: 'top 10 in this server' });
}

export async function prefix(message, args) {
  const sub = args[0]?.toLowerCase();

  if (sub === 'lb' || sub === 'top' || sub === 'board') {
    await message.reply({
      embeds: [await leaderboard(message.guild)],
      allowedMentions: { parse: [] },
    });
    return;
  }

  const channelId = message.channel.id;

  if (running.has(channelId)) {
    await message.reply(say('flag', '`›` a round is already running here.'));
    return;
  }

  const flag = flags[Math.floor(Math.random() * flags.length)];
  const answers = answersOf(flag);
  const round = `${channelId}-${message.id}`;

  const buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`${round}-hint`).setLabel('hint').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`${round}-top`).setLabel('top').setStyle(ButtonStyle.Secondary),
  );

  const sent = await message.reply({
    embeds: [
      panel({
        title: 'flag',
        description: block(datapoint('guess', 'the country'), datapoint('window', `${window / 1000}s`)),
        image: iso(flag[0]),
        footer: `${prefixChar}flag lb — leaderboard`,
      }),
    ],
    components: [buttons],
  });

  running.set(channelId, round);

  const guesses = message.channel.createMessageCollector({
    filter: (candidate) => candidate.channelId === channelId
      && !candidate.author.bot
      && answers.includes(normalize(candidate.content)),
    time: window,
  });

  const presses = sent.createMessageComponentCollector({ time: window });

  const close = async () => {
    running.delete(channelId);
    guesses.stop('settled');
    presses.stop('settled');
    await sent.edit({ components: [lock(buttons)] }).catch(() => {});
  };

  guesses.on('collect', async (winner) => {
    try {
      await close();

      const total = await addPoint(message.guild.id, winner.author.id, winner.author.username)
        .catch(() => null);

      await message.channel.send({
        embeds: [
          panel({
            title: 'flag',
            description: block(
              datapoint('correct', `**${winner.author.username}**`),
              datapoint('answer', `**${flag[1]}**`),
              total === null ? null : datapoint('points', `**${total}**`),
            ),
            footer: `${prefixChar}flag — one more`,
          }),
        ],
        allowedMentions: { parse: [] },
      });
    } catch (error) {
      console.warn('[clydo] flag round skipped —', error?.message ?? error);
    }
  });

  guesses.on('end', async (_collected, reason) => {
    if (reason === 'settled') return;

    try {
      await close();

      await message.channel.send(say(
        'flag',
        datapoint('time up', `the answer was **${flag[1]}**`),
        `${prefixChar}flag — one more`,
      ));
    } catch (error) {
      console.warn('[clydo] flag round skipped —', error?.message ?? error);
    }
  });

  presses.on('collect', async (press) => {
    try {
      if (press.customId.endsWith('-top')) {
        await press.reply({
          embeds: [await leaderboard(message.guild)],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      // a hint is private: posting it would spoil the round for everyone.
      await press.reply({
        embeds: [panel({ title: 'flag', description: datapoint('hint', `\`${hintFor(flag[1])}\``) })],
        flags: MessageFlags.Ephemeral,
      });
    } catch (error) {
      console.warn('[clydo] flag button skipped —', error?.message ?? error);
    }
  });
}
