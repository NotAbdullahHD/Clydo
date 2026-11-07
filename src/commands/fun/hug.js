import { expression } from '../../lib/expression.js';

/** `,hug [@user]` — hug someone, or slink if you name nobody. */

export const name = 'hug';

export const prefix = (message) => expression(message, 'hug');
