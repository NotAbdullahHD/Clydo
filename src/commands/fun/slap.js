import { expression } from '../../lib/expression.js';

/** `,slap [@user]` — a comedic slap. */

export const name = 'slap';

export const prefix = (message) => expression(message, 'slap');
