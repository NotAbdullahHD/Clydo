import {
  ContainerBuilder,
  MediaGalleryBuilder,
  MessageFlags,
  SectionBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  TextDisplayBuilder,
  ThumbnailBuilder,
} from 'discord.js';
import { entry, lower, palette } from './theme.js';

/**
 * hand-built cards.
 *
 * components.js translates embeds for the rest of the bot; the five cards people
 * actually stop and read are written here straight into containers, so their
 * hierarchy is deliberate instead of whatever an embed's title/field grammar
 * allows. one rail, one heading, a rule, then data.
 */

export const V2 = MessageFlags.IsComponentsV2;

/** the neutral rail. status colours are passed explicitly, never by default. */
export const shell = (accent = palette.panel) => new ContainerBuilder().setAccentColor(accent);

export const text = (value) => new TextDisplayBuilder().setContent(String(value ?? ''));

/** discord renders `-#` small and grey — the quiet line. */
export const quiet = (value) => text(`-# ${value}`);

export const rule = () => new SeparatorBuilder()
  .setDivider(true)
  .setSpacing(SeparatorSpacingSize.Small);

/** `## title`, an optional muted note, and an optional round image beside both. */
export function heading(container, { title, note = null, avatar = null }) {
  const lines = [text(`## ${lower(title)}`)];
  if (note) lines.push(quiet(note));

  if (avatar) {
    container.addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(...lines)
        .setThumbnailAccessory(new ThumbnailBuilder().setURL(avatar)),
    );
  } else {
    container.addTextDisplayComponents(...lines);
  }

  return container;
}

/** `• label — value`, one per line. */
export const facts = (pairs) => text(
  pairs.filter(Boolean).map(([label, value]) => entry(label, value)).join('\n'),
);

/** lines the caller already formatted. */
export const listing = (lines) => text(lines.join('\n'));

/** a wide image at the bottom of a card. */
export function picture(container, url) {
  container.addMediaGalleryComponents(new MediaGalleryBuilder().addItems({ media: { url } }));
  return container;
}

/** the payload a card is sent as. */
export const payload = (container) => ({ components: [container], flags: V2 });

/** the shortest card there is: one line, optional title. errors and receipts. */
export function simple({ title = null, message, accent = palette.panel, note = null }) {
  const box = shell(accent);
  if (title) heading(box, { title, note });
  box.addTextDisplayComponents(text(message));
  return payload(box);
}
