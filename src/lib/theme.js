import { EmbedBuilder } from 'discord.js';

/**
 * clydo visual system.
 *
 * doctrine: raw typography, zero emojis, strict lower-case, monochrome only.
 * every response is built from the tokens below — never inline a colour,
 * a glyph or a separator in a command file.
 */

/** primary panel colour — merges with discord dark mode for a native look. */
export const palette = Object.freeze({
  panel: 0x2b2d31,
  recessed: 0x1e1f22,
  void: 0x000000,
  ink: 0xffffff,
});

/** type marks — the only decorative characters clydo is allowed to use. */
export const marks = Object.freeze({
  accent: '›',
  dot: '•',
  dash: '—',
  rule: '━━━━━━━━━━',
});

/** strict lower-case. */
export const lower = (value) => String(value ?? '').toLowerCase();

/** `› label  •  value` — the standard data point line. */
export function datapoint(label, value) {
  return `\`${marks.accent}\` ${lower(label)}  ${marks.dot}  ${value}`;
}

/** `› label  —  value` — the standard list row. */
export function row(label, value) {
  return `\`${marks.accent}\` ${lower(label)}  ${marks.dash}  ${value}`;
}

/**
 * human relative time. discord timestamps cannot render inside a code fence,
 * so the tape needs the text computed here.
 */
export function since(date, now = Date.now()) {
  const seconds = Math.max(0, Math.round((now - new Date(date).getTime()) / 1000));
  const units = [
    ['year', 31_536_000],
    ['month', 2_592_000],
    ['day', 86_400],
    ['hour', 3_600],
    ['minute', 60],
  ];

  for (const [name, size] of units) {
    const value = Math.floor(seconds / size);
    if (value >= 1) return `${value} ${name}${value === 1 ? '' : 's'} ago`;
  }

  return 'just now';
}

/** join lines without trailing whitespace noise. */
export const block = (...lines) => lines.flat().filter(Boolean).join('\n');

/**
 * monospace tape — grouped, column-aligned data inside a fenced block.
 *
 * tape([
 *   { heading: 'btc', rows: [['price', '$68,432.10'], ['change_24h', '-1.42%']] },
 * ])
 *
 * renders:
 *   › btc
 *     price          $68,432.10
 *     change_24h     -1.42%
 */
export function tape(groups, { gap = 3 } = {}) {
  const rows = groups.flatMap((group) => group.rows ?? []);
  const width = rows.reduce((max, [label]) => Math.max(max, lower(label).length), 0);
  const lines = [];

  for (const group of groups) {
    if (group.heading) {
      if (lines.length > 0) lines.push('');
      lines.push(`${marks.accent} ${lower(group.heading)}`);
    }

    for (const [label, value] of group.rows ?? []) {
      lines.push(`  ${lower(label).padEnd(width)}${' '.repeat(gap)}${value}`);
    }
  }

  return ['```', ...lines, '```'].join('\n');
}

/**
 * build a clydo embed.
 * titles, field names and footers are lower-cased automatically.
 */
export function panel({ title, description, fields = [], footer } = {}) {
  const embed = new EmbedBuilder().setColor(palette.panel);

  if (title) embed.setTitle(lower(title));
  if (description) embed.setDescription(description);

  if (fields.length > 0) {
    embed.addFields(
      fields.map((field) => ({
        name: lower(field.name),
        value: field.value,
        inline: Boolean(field.inline),
      })),
    );
  }

  if (footer) embed.setFooter({ text: lower(footer) });

  return embed;
}
