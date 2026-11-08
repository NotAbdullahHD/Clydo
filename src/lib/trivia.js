import { scoreStore } from './scores.js';

/** trivia scores, per server. */

const store = scoreStore({ feature: 'trivia' });

export const addPoint = store.add;
export const board = store.board;
export const total = store.total;
