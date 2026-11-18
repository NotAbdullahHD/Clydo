import { createCanvas } from '@napi-rs/canvas';
import { font } from './fonts.js';

/**
 * the level card.
 *
 * one 800×400 png: a rounded dark panel, the member's face and name at the top,
 * three lines of numbers under it, then the level either side of a progress bar
 * with the percentage floating above it. the big numerals are mint against the
 * grey, the dot on the bar is the one lavender accent.
 *
 * fonts come from `fonts.js` — the renderer ships none, so a host without a
 * match draws in the platform sans instead.
 */

const WIDTH = 800;
const HEIGHT = 400;
const CORNER = 16;

const ink = {
  bright: '#f2f3f5',
  muted: '#b5bac1',
  faint: '#8a8f98',
  mint: '#a9e7d4',
  accent: '#8d7bb4',
  track: '#4a4d55',
};


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

/** the member's face in a circle, or their initial when the avatar 404s. */
function portrait(ctx, image, cx, cy, radius, name) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();

  if (image) {
    const scale = Math.max((radius * 2) / image.width, (radius * 2) / image.height);
    ctx.drawImage(
      image,
      cx - (image.width * scale) / 2,
      cy - (image.height * scale) / 2,
      image.width * scale,
      image.height * scale,
    );
  } else {
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = '#3f4148';
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = font(Math.round(radius * 0.95), true);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText((name || '?').slice(0, 1).toUpperCase(), cx, cy + radius * 0.05);
  }

  ctx.restore();
}

/** `@lvl 2` as a rounded chip, the way discord draws a role mention. */
function chip(ctx, x, baseline, label) {
  ctx.font = font(17, true);
  const width = Math.ceil(ctx.measureText(label).width) + 24;

  rounded(ctx, x, baseline - 20, width, 28, 7);
  ctx.fillStyle = 'rgba(141,123,180,0.28)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(141,123,180,0.35)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#e2d9fb';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText(label, x + 12, baseline - 5);
  ctx.textBaseline = 'alphabetic';

  return width;
}

/**
 * render the card.
 * @param {{ name: string, avatar?: unknown, level: number, xp: number, rank: number,
 *   into: number, span: number, percent: number, role?: string|null }} card
 * @returns {Promise<Buffer>} png bytes
 */
export async function render({ name, avatar = null, level, xp, rank, into, span, percent, role = null }) {
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');

  // panel
  const base = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  base.addColorStop(0, '#34373d');
  base.addColorStop(0.55, '#2f3136');
  base.addColorStop(1, '#2b2d31');
  rounded(ctx, 0, 0, WIDTH, HEIGHT, CORNER);
  ctx.fillStyle = base;
  ctx.fill();

  ctx.save();
  rounded(ctx, 0, 0, WIDTH, HEIGHT, CORNER);
  ctx.clip();

  const glow = ctx.createRadialGradient(150, 20, 10, 150, 20, 320);
  glow.addColorStop(0, 'rgba(255,255,255,0.05)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.restore();

  rounded(ctx, 0.5, 0.5, WIDTH - 1, HEIGHT - 1, CORNER);
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // header
  portrait(ctx, avatar, 46, 42, 16, name);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = ink.bright;
  ctx.font = font(19, true);
  ctx.fillText(name.toLowerCase(), 72, 49);

  // level · xp · rank
  ctx.font = font(25, true);
  ctx.fillStyle = ink.bright;
  ctx.fillText('Level', 40, 116);
  const lead = ctx.measureText('Level').width;

  ctx.font = font(25);
  ctx.fillStyle = ink.muted;
  ctx.fillText(` ${level} · ${xp.toLocaleString('en-US')} XP · rank #${rank}`, 40 + lead, 116);

  // progress toward the next level
  ctx.font = font(19);
  ctx.fillStyle = ink.muted;
  ctx.fillText(`${into.toLocaleString('en-US')} / ${span.toLocaleString('en-US')} XP to level ${level + 1}`, 40, 154);

  // next role
  if (role) {
    ctx.font = font(19);
    ctx.fillStyle = ink.muted;
    ctx.fillText('next role:', 40, 196);
    const width = ctx.measureText('next role:').width;
    chip(ctx, 40 + width + 10, 196, `@${role}`);

    ctx.font = font(19);
    ctx.fillStyle = ink.faint;
    const chipWidth = ctx.measureText(`@${role}`).width + 34;
    ctx.fillText('at level ' + (Number(String(role).match(/\d+/)?.[0]) || level + 1), 40 + width + 20 + chipWidth, 196);
  }

  // the two levels, either side of the bar
  const barLeft = 170;
  const barRight = WIDTH - 170;
  const barY = 302;
  const barHeight = 16;
  const middle = barY + barHeight / 2;

  ctx.font = font(92, true);
  ctx.fillStyle = ink.mint;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(level), 84, middle - 4);
  ctx.textAlign = 'right';
  ctx.fillText(String(level + 1), WIDTH - 84, middle - 4);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  // track
  rounded(ctx, barLeft, barY, barRight - barLeft, barHeight, barHeight / 2);
  ctx.fillStyle = ink.track;
  ctx.fill();

  // the percentage floats above the dot
  const clamped = Math.max(0, Math.min(100, percent));
  const dotX = barLeft + ((barRight - barLeft) * clamped) / 100;

  ctx.font = font(18);
  ctx.fillStyle = ink.muted;
  ctx.textAlign = 'center';
  ctx.fillText(`${clamped}%`, dotX, barY - 26);
  ctx.textAlign = 'left';

  // the dot, with a little bloom so it reads at a glance
  ctx.save();
  ctx.shadowColor = 'rgba(141,123,180,0.8)';
  ctx.shadowBlur = 18;
  ctx.beginPath();
  ctx.arc(dotX, middle, 13, 0, Math.PI * 2);
  ctx.fillStyle = ink.accent;
  ctx.fill();
  ctx.restore();

  return canvas.encode('png');
}
