import { expression } from '../../lib/expression.js';

/** `,kiss [@user]` — kiss someone, or slink if you name nobody. */

export const name = 'kiss';

export const prefix = (message) => expression(message, 'kiss');
