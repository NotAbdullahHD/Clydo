import { GlobalFonts } from '@napi-rs/canvas';

/**
 * the type stack.
 *
 * the png renderer ships no fonts of its own — it asks the host. so every card
 * registers the first family it can find and falls back to the platform sans.
 * the list covers windows, debian and the usual container mounts; a miss costs a
 * family, never the card, and registration happens once on import.
 *
 * registered names are fixed (`slink-sans`, `slink-sans-bold`) rather than the
 * file's real family, so a card asks for the same font on every host.
 */

const families = { regular: 'slink-sans', bold: 'slink-sans-bold' };

const candidates = {
  regular: [
    'C:/Windows/Fonts/segoeui.ttf',
    'C:/Windows/Fonts/arial.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    '/usr/share/fonts/dejavu/DejaVuSans.ttf',
    '/usr/share/fonts/TTF/DejaVuSans.ttf',
    '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
    '/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf',
    '/usr/share/fonts/noto/NotoSans-Regular.ttf',
    '/usr/share/fonts/truetype/freefont/FreeSans.ttf',
  ],
  bold: [
    'C:/Windows/Fonts/segoeuib.ttf',
    'C:/Windows/Fonts/arialbd.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
    '/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf',
    '/usr/share/fonts/TTF/DejaVuSans-Bold.ttf',
    '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
    '/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf',
    '/usr/share/fonts/noto/NotoSans-Bold.ttf',
    '/usr/share/fonts/truetype/freefont/FreeSansBold.ttf',
  ],
};

const found = { regular: false, bold: false };

for (const [weight, paths] of Object.entries(candidates)) {
  for (const file of paths) {
    try {
      if (GlobalFonts.registerFromPath(file, families[weight])) {
        found[weight] = true;
        break;
      }
    } catch {
      // missing host font — try the next one.
    }
  }
}

/** true once at least one family registered, so a caller can mention the miss. */
export const hasFonts = () => found.regular || found.bold;

/** the family to ask for; a bold request never falls back to nothing. */
function family(bold) {
  if (bold && found.bold) return families.bold;
  if (found.regular) return families.regular;
  if (found.bold) return families.bold;

  return 'sans-serif';
}

/**
 * `600 20px slink-sans` — the canvas font shorthand.
 *
 * `bold` keeps the old two-argument call shape; `weight` overrides the numeric
 * weight when a card wants 600 for a label that is not bold-bold.
 */
export const font = (size, bold = false, weight = null) => (
  `${weight ?? (bold ? 'bold' : '400')} ${size}px ${family(bold)}`
);
