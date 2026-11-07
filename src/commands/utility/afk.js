import { clear, get, set } from '../../lib/afk.js';
import { panel } from '../../lib/theme.js';

/** `,afk [reason]` — mark yourself away. `,afk off` clears it early. */

export const name = 'afk';

const maxReason = 200;

export async function prefix(message, args) {
  const head = args[0]?.toLowerCase();

  if (head === 'off' || head === 'clear') {
    const state = await get(message.author.id);

    await clear(message.author.id);

    await message.reply({
      embeds: [panel({
        title: 'afk',
        description: state.isAfk ? 'you are back.' : 'you were not afk.',
      })],
    });
    return;
  }

  const reason = (args.join(' ').trim() || 'afk').slice(0, maxReason);
  await set(message.author.id, reason);

  await message.reply({
    embeds: [panel({
      title: 'afk',
      description: `you are now afk — **${reason}**`,
      footer: 'your next message clears it',
    })],
    allowedMentions: { parse: [] },
  });
}
