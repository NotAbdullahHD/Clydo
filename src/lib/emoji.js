/**
 * slink's own marks.
 *
 * application emojis replace the unicode glyphs that were standing in. every
 * entry keeps its glyph, so a deleted or unapproved emoji degrades to the old
 * character instead of a broken box, and one file is the only place an id
 * ever lives.
 */

const marks = {
  check: { id: '1569036843151007977', name: 'check_slink', glyph: '✅' },
  cross: { id: '1569036845092962396', name: 'cross_slink', glyph: '❌' },
  warning: { id: '1569036847110430821', name: 'warning_slink', glyph: '⚠️' },
  orbs: { id: '1569036849220165692', name: 'orbs_slink', glyph: '🟡' },
};

/**
 * the six gift tiers, lowest first.
 *
 * `from` is the pot size that earns the box, so the art climbs with the money:
 * mint at 200 (a daily), pink once a gift is worth a hundred dailies. the order
 * was picked from the colours — green, teal, blue, purple, gold, pink.
 */
export const tiers = [
  { key: 'hero', name: 'hero_slink', id: '1569042380168892616', glyph: '🎁', from: 0 },
  { key: 'champion', name: 'champion_slink', id: '1569042381423255612', glyph: '🎁', from: 250 },
  { key: 'patron', name: 'patron_slink', id: '1569042382824017998', glyph: '🎁', from: 1_000 },
  { key: 'icon', name: 'icon_slink', id: '1569042384761917521', glyph: '🎁', from: 5_000 },
  { key: 'legend', name: 'legend_slink', id: '1569042386133192724', glyph: '🎁', from: 25_000 },
  { key: 'luminary', name: 'luminary_slink', id: '1569042387123179553', glyph: '🎁', from: 100_000 },
];

const render = ({ id, name, glyph }) => (id ? `<:${name}:${id}>` : glyph);

export const emoji = Object.fromEntries(
  Object.entries(marks).map(([key, value]) => [key, render(value)]),
);

/** the bare ids, for code that builds its own mention. */
export const ids = Object.fromEntries(
  Object.entries(marks).map(([key, value]) => [key, value.id]),
);

/** the tier a pot of this size belongs to. */
export function tierOf(value) {
  const pot = Math.max(0, Number(value) || 0);

  return tiers.reduce((best, entry) => (pot >= entry.from ? entry : best), tiers[0]);
}

/** the rendered box a pot of this size is wrapped in. */
export const tier = (value) => render(tierOf(value));

/**
 * fall back to the glyph for any mark this application no longer owns.
 * an id that resolves to nothing renders as raw `<:name:id>` text in a reply,
 * which is worse than the character it replaced.
 */
export async function validate(client, log = () => {}) {
  const missing = [];

  for (const [key, entry] of Object.entries(marks)) {
    if (!entry.id) continue;

    const found = await client.application?.emojis?.fetch(entry.id).catch(() => null);
    if (found) continue;

    emoji[key] = entry.glyph;
    missing.push(key);
  }

  for (const entry of tiers) {
    if (!entry.id) continue;

    const found = await client.application?.emojis?.fetch(entry.id).catch(() => null);
    if (found) continue;

    entry.id = null;
    missing.push(entry.key);
  }

  if (missing.length) {
    log(`emoji fallback — ${missing.join(', ')} not found on this application.`);
  }

  return missing;
}
