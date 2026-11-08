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

const render = ({ id, name, glyph }) => (id ? `<:${name}:${id}>` : glyph);

export const emoji = Object.fromEntries(
  Object.entries(marks).map(([key, value]) => [key, render(value)]),
);

/** the bare ids, for code that builds its own mention. */
export const ids = Object.fromEntries(
  Object.entries(marks).map(([key, value]) => [key, value.id]),
);

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

  if (missing.length) {
    log(`emoji fallback — ${missing.join(', ')} not found on this application.`);
  }

  return missing;
}
