import { hintFor, rounds } from './flag.js';

/**
 * the flag embed tells people to try `,flaghint`, so it has to exist. it hints
 * at the round running in this channel and nothing else.
 */

export const name = 'flaghint';
export const names = ['flagh'];

export async function prefix(message) {
  const round = rounds.get(message.channel.id);

  if (!round) {
    await message.reply('❌ No flag game is running here! start one with `,flag`');
    return;
  }

  await message.reply(`🔵 **${message.author}** requested a hint:\nHint: \`${hintFor(round.flag[1])}\``);
}
