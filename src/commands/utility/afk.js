import { clear, get, set } from '../../lib/afk.js';
import { aside, ok, say } from '../../lib/line.js';

/**
 * `,afk [reason]` — mark yourself away. `,afk off` clears it early.
 */

export const name = 'afk';

const maxReason = 200;

export async function prefix(message, args) {
  const head = args[0]?.toLowerCase();

  if (head === 'off' || head === 'clear') {
    const state = await get(message.author.id);
    await clear(message.author.id);

    await message.reply(state.isAfk ? ok(message, 'you are back.') : aside('you were not afk.'));
    return;
  }

  const reason = (args.join(' ').trim() || 'afk').slice(0, maxReason);
  await set(message.author.id, reason);

  await message.reply(say(`${ok(message, `afk — **${reason}**.`).content}\n-# your next message clears it`));
}
