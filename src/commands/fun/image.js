import { search } from './google.js';

/** `,image` — the same search, image results instead of pages. */

export const name = 'image';
export const names = ['img', 'im'];

export async function prefix(message, args) {
  await search(message, args, 'image');
}
