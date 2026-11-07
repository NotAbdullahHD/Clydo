import { expression } from '../../lib/expression.js';

/** `,highfive [@user]` — a high five. */

export const name = 'highfive';

export const prefix = (message) => expression(message, 'highfive');
