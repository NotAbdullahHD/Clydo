import { scoreStore } from './scores.js';

/** flag game scores, per server. */

const store = scoreStore({ collection: 'flags', file: 'flags.json' });

export const addPoint = store.add;
export const board = store.board;
export const total = store.total;
