import { expression } from '../../lib/expression.js';

/** `,cry` — a good cry. */

export const name = 'cry';

export const prefix = (message) => expression(message, 'cry');
