import { GlobalFonts, createCanvas, loadImage } from '@napi-rs/canvas';

/**
 * the ship card.
 *
 * one 720×372 png: a rounded, near-black panel with a pink bloom, two circular
 * avatars in thick pink rings, a vector heart carrying the score between them,
 * a fill bar underneath and the handles plus caption at the bottom.
 *
 * fonts come from the host because the renderer ships none — the register call
 * is best-effort and falls back to the platform sans.
 */

const WIDTH = 720;
const HEIGHT = 372;
const CORNER = 26;

const pink = {
  light: '#ffa8c6',
  core: '#ff5f92',
  deep: '#d92f68',
};

const families = { regular: 'slink-sans', bold: 'slink-sans-bold' };
let hasFonts = false;

for (const [path, name] of [
  ['C:/Windows/Fonts/segoeui.ttf', families.regular],
  ['C:/Windows/Fonts/segoeuib.ttf', families.bold],
  ['C:/Windows/Fonts/arial.ttf', families.regular],
  ['C:/Windows/Fonts/arialbd.ttf', families.bold],
  ['/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', families.regular],
  ['/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', families.bold],
]) {
  try {
    if (GlobalFonts.registerFromPath(path, name)) hasFonts = true;
  } catch {
    // a missing host font is not a failure; the fallback below covers it.
  }
}

const font = (size, bold = false) => `${bold ? 'bold ' : ''}${size}px ${hasFonts ? (bold ? families.bold : families.regular) : 'sans-serif'}`;

function rounded(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);

  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function heart(ctx, cx, cy, size) {
  ctx.beginPath();
  ctx.moveTo(cx, cy + size * 0.62);
  ctx.bezierCurveTo(cx - size * 0.98, cy - size * 0.04, cx - size * 0.5, cy - size * 0.96, cx, cy - size * 0.3);
  ctx.bezierCurveTo(cx + size * 0.5, cy - size * 0.96, cx + size * 0.98, cy - size * 0.04, cx, cy + size * 0.62);
  ctx.closePath();
}

function cover(ctx, image, cx, cy, radius) {
  const scale = Math.max((radius * 2) / image.width, (radius * 2) / image.height);
  const width = image.width * scale;
  const height = image.height * scale;

  ctx.drawImage(image, cx - width / 2, cy - height / 2, width, height);
}

/** a pink ring with the portrait clipped inside it, or a monogram if it 404s. */
function portrait(ctx, image, cx, cy, radius, name) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();

  if (image) {
    cover(ctx, image, cx, cy, radius);
  } else {
    const fallback = ctx.createLinearGradient(cx - radius, cy - radius, cx + radius, cy + radius);
    fallback.addColorStop(0, '#3a2030');
    fallback.addColorStop(1, '#161018');
    ctx.fillStyle = fallback;
    ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);

    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = font(Math.round(radius * 0.9), true);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText((name || '?').slice(0, 1).toUpperCase(), cx, cy + radius * 0.04);
  }

  ctx.restore();

  ctx.save();
  ctx.lineWidth = 6;
  ctx.strokeStyle = pink.core;
  ctx.shadowColor = 'rgba(255,95,146,0.55)';
  ctx.shadowBlur = 20;
  ctx.beginPath();
  ctx.arc(cx, cy, radius + 1, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/** download an avatar; any failure returns null and the monogram takes over. */
export async function loadAvatar(url) {
  if (!url) return null;

  try {
    const response = await fetch(url, { headers: { 'user-agent': 'slink (discord bot)' } });

    if (!response.ok) return null;

    return await loadImage(Buffer.from(await response.arrayBuffer()));
  } catch {
    return null;
  }
}

/**
 * render the card.
 * @param {{ percent: number, caption: string, names: string[], images?: Array<unknown> }} card
 * @returns {Promise<Buffer>} png bytes
 */
export async function render({ percent, caption, names, images = [] }) {
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');
  const [first, second] = names;

  // panel
  const base = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  base.addColorStop(0, '#2a1220');
  base.addColorStop(0.5, '#150d15');
  base.addColorStop(1, '#050406');
  rounded(ctx, 0, 0, WIDTH, HEIGHT, CORNER);
  ctx.fillStyle = base;
  ctx.fill();

  ctx.save();
  rounded(ctx, 0, 0, WIDTH, HEIGHT, CORNER);
  ctx.clip();

  const bloom = ctx.createRadialGradient(WIDTH / 2, 150, 12, WIDTH / 2, 150, 300);
  bloom.addColorStop(0, 'rgba(255,95,146,0.20)');
  bloom.addColorStop(0.55, 'rgba(255,95,146,0.05)');
  bloom.addColorStop(1, 'rgba(255,95,146,0)');
  ctx.fillStyle = bloom;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // a light behind each portrait, so the corners stay dark and the faces glow
  for (const cx of [150, WIDTH - 150]) {
    const halo = ctx.createRadialGradient(cx, 142, 30, cx, 142, 190);
    halo.addColorStop(0, 'rgba(255,95,146,0.20)');
    halo.addColorStop(1, 'rgba(255,95,146,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(cx - 200, 0, 400, 330);
  }

  ctx.restore();

  rounded(ctx, 0.5, 0.5, WIDTH - 1, HEIGHT - 1, CORNER);
  ctx.strokeStyle = 'rgba(255,255,255,0.07)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // avatars
  portrait(ctx, images[0] ?? null, 150, 142, 82, first);
  portrait(ctx, images[1] ?? null, WIDTH - 150, 142, 82, second);

  // heart with the score inside it
  ctx.save();
  heart(ctx, WIDTH / 2, 148, 82);
  const heartFill = ctx.createLinearGradient(0, 92, 0, 214);
  heartFill.addColorStop(0, pink.light);
  heartFill.addColorStop(1, pink.deep);
  ctx.fillStyle = heartFill;
  ctx.shadowColor = 'rgba(255,95,146,0.5)';
  ctx.shadowBlur = 26;
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.font = font(percent >= 100 ? 31 : 34, true);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${percent}%`, WIDTH / 2, 152);
  ctx.restore();

  // handles
  ctx.fillStyle = 'rgba(232,214,236,0.92)';
  ctx.font = font(17, true);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(first.toLowerCase(), 150, 256);
  ctx.fillText(second.toLowerCase(), WIDTH - 150, 256);

  // bar
  const trackWidth = 340;
  const trackX = (WIDTH - trackWidth) / 2;
  const trackY = 289;
  const trackHeight = 10;

  rounded(ctx, trackX, trackY, trackWidth, trackHeight, trackHeight / 2);
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  ctx.fill();

  if (percent > 0) {
    const filled = Math.max(trackHeight, Math.round((percent / 100) * trackWidth));

    rounded(ctx, trackX, trackY, filled, trackHeight, trackHeight / 2);
    const fill = ctx.createLinearGradient(trackX, 0, trackX + trackWidth, 0);
    fill.addColorStop(0, pink.core);
    fill.addColorStop(1, pink.deep);
    ctx.fillStyle = fill;
    ctx.shadowColor = 'rgba(255,95,146,0.5)';
    ctx.shadowBlur = 14;
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  // caption + mark
  ctx.fillStyle = 'rgba(205,186,215,0.88)';
  ctx.font = font(14);
  ctx.textAlign = 'center';
  ctx.fillText(caption.toLowerCase(), WIDTH / 2, 323);

  ctx.fillStyle = 'rgba(255,255,255,0.30)';
  ctx.font = font(11, true);
  ctx.fillText('slink', WIDTH / 2, 350);

  return canvas.encode('png');
}
