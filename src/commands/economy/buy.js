import { bad } from '../../lib/economy.js';

/** `,buy <item>` — nothing to sell yet. */

export const name = 'buy';

export async function prefix(message) {
  await message.reply({
    embeds: [bad('shop items have not been created yet.')],
  });
}
