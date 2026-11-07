import { expression } from '../../lib/expression.js';

/** `,pat [@user]` — headpats. */

export const name = 'pat';

export const prefix = (message) => expression(message, 'pat');
