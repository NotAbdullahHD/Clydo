/**
 * the shop catalogue. collectibles only — nothing here touches permissions,
 * so a purchase can never hand someone leverage over a server.
 */

export const items = [
  { id: 'rock', name: 'smooth rock', price: 50, blurb: 'it is a rock.' },
  { id: 'coffee', name: 'cold coffee', price: 120, blurb: 'still counts.' },
  { id: 'vhs', name: 'unlabelled vhs', price: 900, blurb: 'probably fine.' },
  { id: 'plush', name: 'plush gotoh', price: 2_400, blurb: 'pink, quiet, judging you.' },
  { id: 'crown', name: 'paper crown', price: 5_000, blurb: 'folds under pressure.' },
  { id: 'keyboard', name: 'thock keyboard', price: 9_000, blurb: 'loud enough to annoy the call.' },
];

/** find by id or by display name, case-insensitive. */
export const find = (query) => {
  const wanted = String(query ?? '').toLowerCase().replace(/\s+/g, ' ');
  return items.find((item) => item.id === wanted || item.name === wanted) ?? null;
};
