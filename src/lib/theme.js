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

/** join lines without trailing whitespace noise. */
export const block = (...lines) => lines.flat().filter(Boolean).join('\n');

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
