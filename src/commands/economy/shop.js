import { card } from '../../lib/economy.js';

/** `,shop` — parked until the catalogue is worth browsing. */

export const name = 'shop';
export const names = ['store'];

export async function prefix(message) {
  await message.reply({
    embeds: [card('shop', 'shop items have not been created yet.')],
  });
}
