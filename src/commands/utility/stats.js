import { SlashCommandBuilder } from 'discord.js';
import { live, messages, voiceTime } from '../../lib/activity.js';
import { datapoint, panel } from '../../lib/theme.js';

/**
 * `/stats` and `,stats` — what a member has done here.
 *
 * messages and voice time, each as a lifetime total with today beside it. voice
 * minutes spent in a channel right now are counted, so the number is never an
 * hour stale.
 */

export const name = 'stats';
export const names = ['stat'];

export const data = new SlashCommandBuilder()
  .setName('stats')
  .setDescription('messages and voice time')
  .addUserOption((option) => option
    .setName('user')
    .setDescription('someone else — you by default'));

const count = (value) => Number(value ?? 0).toLocaleString('en-US');

/** `4h 12m`, or `12m` under an hour. */
export function clock(seconds) {
  const whole = Math.max(0, Math.floor(Number(seconds) || 0));
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);

  return hours ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function view(guildId, user) {
  const texts = messages(guildId, user.id);
  const voice = voiceTime(guildId, user.id);
  const now = live(guildId, user.id);

  return {
    embeds: [panel({
      title: `${user.username} · stats`,
      description: [
        datapoint('messages', `**${count(texts.total)}** total · ${count(texts.today)} today`),
        datapoint('voice', `**${clock(voice.total + now)}** total · ${clock(voice.today + now)} today`),
      ].join('\n'),
      footer: now ? 'the voice number includes the call you are in right now.' : 'today resets at midnight utc.',
    })],
  };
}

export async function execute(interaction) {
  const user = interaction.options.getUser('user') ?? interaction.user;

  await interaction.reply(view(interaction.guildId, user));
}

export async function prefix(message, args) {
  if (!message.guild) return;

  const user = message.mentions.users?.first?.()
    ?? (args[0] ? await message.client.users.fetch(args[0].replace(/[<@!>]/g, '')).catch(() => null) : null)
    ?? message.author;

  await message.reply(view(message.guild.id, user));
}
