import { scoreStore } from './scores.js';

/** trivia scores, per server. */

const store = scoreStore({ collection: 'trivia', file: 'trivia.json' });

export const addPoint = store.add;
export const board = store.board;
export const total = store.total;
