import { createCanvas, loadImage } from '@napi-rs/canvas';
import { sql } from './sqlite.js';
import { palette } from './theme.js';

/**
 * the accent.
 *
 * one colour per scope, resolved in this order: the user's own pick, the
 * server's pick, the dominant colour of the avatar being shown, then discord
 * grey. a personal card should look like the person, and a server should be
 * able to give every panel its own tint without touching a command.
 */

const cache = new Map();
const ceiling = 600;

/** `#8d7bb4`, `8d7bb4`, `#8D7` → `#8d7bb4`; anything else → null. */
export function parse(value) {
  const text = String(value ?? '').trim().replace(/^#/, '');

  if (!/^(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(text)) return null;

  const full = text.length === 3
    ? text.split('').map((part) => part.repeat(2)).join('')
    : text;

  return `#${full.toLowerCase()}`;
}

/** a stored colour as the integer discord embeds want. */
export const number = (hex) => (hex ? Number.parseInt(hex.slice(1), 16) : palette.panel);

export function of(scope, id) {
  const key = `${scope}:${id}`;
  if (cache.has(key)) return cache.get(key);

  const row = sql().prepare('SELECT value FROM paint WHERE scope = ? AND id = ?').get(scope, id);
  remember(key, row?.value ?? null);

  return row?.value ?? null;
}

export function set(scope, id, value) {
  const hex = parse(value);
  if (!hex) return null;

  sql()
    .prepare(`
      INSERT INTO paint (scope, id, value) VALUES (?, ?, ?)
      ON CONFLICT (scope, id) DO UPDATE SET value = excluded.value
    `)
    .run(scope, id, hex);

  remember(`${scope}:${id}`, hex);

  return hex;
}

export function reset(scope, id) {
  sql().prepare('DELETE FROM paint WHERE scope = ? AND id = ?').run(scope, id);
  cache.delete(`${scope}:${id}`);
}

function remember(key, value) {
  if (cache.size > ceiling) cache.delete(cache.keys().next().value);
  cache.set(key, value);
}

const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

/** pull a colour up out of near-black or near-grey so a panel stays readable. */
function lift([r, g, b]) {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;

  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;

  let hue = 0;
  if (delta) {
    if (max === red) hue = ((green - blue) / delta) % 6;
    else if (max === green) hue = (blue - red) / delta + 2;
    else hue = (red - green) / delta + 4;
    hue *= 60;
    if (hue < 0) hue += 360;
  }

  const lightness = (max + min) / 2;
  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));

  const muted = clamp(saturation, 0.28, 0.7);
  const tone = clamp(lightness, 0.38, 0.62);

  const chroma = (1 - Math.abs(2 * tone - 1)) * muted;
  const second = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
  const offset = tone - chroma / 2;

  const order = [
    [chroma, second, 0],
    [second, chroma, 0],
    [0, chroma, second],
    [0, second, chroma],
    [second, 0, chroma],
    [chroma, 0, second],
  ][Math.floor(hue / 60) % 6];

  return `#${order
    .map((part) => Math.round((part + offset) * 255).toString(16).padStart(2, '0'))
    .join('')}`;
}

/** the average of an avatar, lifted until it can carry white text. */
export async function dominant(url, size = 48) {
  if (!url) return null;

  const canvas = createCanvas(size, size);
  const context = canvas.getContext('2d');
  const image = await loadImage(url);

  context.drawImage(image, 0, 0, size, size);

  const { data } = context.getImageData(0, 0, size, size);
  let red = 0;
  let green = 0;
  let blue = 0;
  let pixels = 0;

  for (let at = 0; at < data.length; at += 4) {
    if (data[at + 3] < 128) continue;

    red += data[at];
    green += data[at + 1];
    blue += data[at + 2];
    pixels += 1;
  }

  if (!pixels) return null;

  return lift([red / pixels, green / pixels, blue / pixels]);
}

/** the accent for this reply: user, then server, then the face shown, then grey. */
export async function accent({ guildId = null, userId = null, member = null } = {}) {
  if (userId) {
    const own = of('user', userId);
    if (own) return number(own);
  }

  if (guildId) {
    const guild = of('guild', guildId);
    if (guild) return number(guild);
  }

  const url = member?.displayAvatarURL?.({ size: 64 }) ?? null;
  if (!url) return palette.panel;

  const key = `face:${url}`;
  if (cache.has(key)) return number(cache.get(key));

  const hex = await dominant(url).catch(() => null);
  if (!hex) return palette.panel;

  remember(key, hex);

  return number(hex);
}
