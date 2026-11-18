import { createCanvas, loadImage } from '@napi-rs/canvas';

/**
 * the album grid.
 *
 * a square of cover art, three to five across. anything that will not load
 * becomes one grey tile with the album name on it, so a missing image costs a
 * tile and never the whole chart.
 */

const tile = 220;
const gap = 14;
const pad = 18;

export async function collage({ albums, size = 3, heading = null }) {
  const across = Math.min(5, Math.max(3, Number(size) || 3));
  const rows = Math.ceil(albums.length / across);
  const header = heading ? 46 : 0;

  const width = pad * 2 + across * tile + (across - 1) * gap;
  const height = pad * 2 + header + rows * tile + Math.max(0, rows - 1) * gap;

  const canvas = createCanvas(width, height);
  const context = canvas.getContext('2d');

  context.fillStyle = '#2b2d31';
  context.fillRect(0, 0, width, height);

  if (heading) {
    context.fillStyle = '#8d7bb4';
    context.font = '600 20px segoeui, arial';
    context.fillText(heading, pad, pad + 22);
  }

  for (let index = 0; index < across * Math.max(1, rows); index += 1) {
    const album = albums[index];
    const column = index % across;
    const row = Math.floor(index / across);
    const x = pad + column * (tile + gap);
    const y = pad + header + row * (tile + gap);

    context.save();
    context.beginPath();
    context.roundRect(x, y, tile, tile, 14);
    context.clip();

    if (!album) {
      context.fillStyle = '#1e1f22';
      context.fillRect(x, y, tile, tile);
      context.restore();
      continue;
    }

    const image = album.art ? await loadImage(album.art).catch(() => null) : null;

    if (image) {
      context.drawImage(image, x, y, tile, tile);
    } else {
      context.fillStyle = '#1e1f22';
      context.fillRect(x, y, tile, tile);

      context.fillStyle = '#8a8d93';
      context.font = '600 16px segoeui, arial';

      const words = String(album.name ?? 'album').split(/\s+/);
      let line = 0;

      for (const word of words) {
        if (line > 5) break;
        const trimmed = word.length > 22 ? `${word.slice(0, 21)}…` : word;
        context.fillText(trimmed, x + 14, y + 36 + line * 22);
        line += 1;
      }
    }

    // a soft floor so the title stays readable on bright covers.
    const shade = context.createLinearGradient(0, y + tile - 64, 0, y + tile);
    shade.addColorStop(0, 'rgba(0,0,0,0)');
    shade.addColorStop(1, 'rgba(0,0,0,0.82)');
    context.fillStyle = shade;
    context.fillRect(x, y + tile - 64, tile, 64);

    context.fillStyle = '#ffffff';
    context.font = '600 15px segoeui, arial';
    context.fillText(String(album.name ?? '').slice(0, 26), x + 12, y + tile - 26);

    context.fillStyle = '#c9cbd1';
    context.font = '400 13px segoeui, arial';
    context.fillText(String(album.artist ?? '').slice(0, 28), x + 12, y + tile - 10);

    context.restore();
  }

  return canvas.encode('png');
}
