/**
 * slink's own marks.
 *
 * application emojis replace the unicode glyphs that were standing in. every
 * entry keeps its glyph, so a deleted or unapproved emoji degrades to the old
 * character instead of a broken box, and one file is the only place an id
 * ever lives.
 */

const marks = {
  check: { id: '1569032584233746503', name: 'check_slink', glyph: '✅' },
  cross: { id: '1569031121033895956', name: 'cross_slink', glyph: '❌' },
  warning: { id: '1569032941026148353', name: 'warning_slink', glyph: '⚠️' },
  orbs: { id: '1569033509362995370', name: 'orbs_slink', glyph: '🟡' },
};

const render = ({ id, name, glyph }) => (id ? `<:${name}:${id}>` : glyph);

export const emoji = Object.fromEntries(
  Object.entries(marks).map(([key, value]) => [key, render(value)]),
);

/** the bare ids, for code that builds its own mention. */
export const ids = Object.fromEntries(
  Object.entries(marks).map(([key, value]) => [key, value.id]),
);
