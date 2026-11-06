import { EmbedBuilder } from 'discord.js';

/**
 * clydo visual system.
 *
 * doctrine: raw typography, zero emojis, strict lower-case, monochrome only.
 * every response is built from the tokens below — never inline a colour,
 * a glyph or a separator in a command file.
 *
 * one shape for every reply:
 *   title        the command name, lower-case
 *   description  group headings (`›`) with data lines (`•`) beneath them
 *   footer       a short closing line
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

/** `› label  •  value` — a single data point. */
export function datapoint(label, value) {
  return `\`${marks.accent}\` ${lower(label)}  ${marks.dot}  ${value}`;
}

/** `› label  —  value` — a single list row. */
export function row(label, value) {
  return `\`${marks.accent}\` ${lower(label)}  ${marks.dash}  ${value}`;
}

/** `• label  —  value` — a data line under a group heading. */
export function entry(label, value) {
  return `\`${marks.dot}\` ${lower(label)}  ${marks.dash}  ${value}`;
}

/** join lines without trailing whitespace noise. */
export const block = (...lines) => lines.flat().filter(Boolean).join('\n');

/** a group heading with its data lines beneath it. */
export function section({ heading, rows = [] }) {
  const lines = rows.filter(Boolean).map(([label, value]) => entry(label, value));
  if (heading) lines.unshift(`\`${marks.accent}\` ${lower(heading)}`);
  return lines.join('\n');
}

/** stack sections with one blank line between them. */
export const sections = (...groups) => groups.filter(Boolean).join('\n\n');

/**
 * human relative time. discord timestamps cannot render inside a rich block,
 * so dates are computed here.
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
