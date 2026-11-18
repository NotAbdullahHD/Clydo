import { sql } from './sqlite.js';

/**
 * last.fm.
 *
 * one username per discord account, one layout per username, and one cached
 * crown per person — the artist they listen to most. every read goes through
 * `call`, so the api key stays in one place and a missing key is a readable
 * error rather than a broken card.
 */

const endpoint = 'https://ws.audioscrobbler.com/2.0/';

export const configured = () => Boolean(process.env.LASTFM_API_KEY?.trim());

export const defaultTemplate = '**{track}**\n{artist}  ·  {album}';

export const variables = ['{track}', '{artist}', '{album}', '{plays}', '{user}', '{url}', '{playing}'];

export async function call(method, params = {}) {
  const key = process.env.LASTFM_API_KEY?.trim();
  if (!key) throw new Error('last.fm is not set up — add `LASTFM_API_KEY`.');

  const query = new URLSearchParams({ method, api_key: key, format: 'json', ...params });
  const response = await fetch(`${endpoint}?${query}`);
  const data = await response.json().catch(() => ({}));

  if (data.error) throw new Error(data.message || `last.fm error ${data.error}`);
  if (!response.ok) throw new Error(`last.fm answered ${response.status}`);

  return data;
}

export async function getUser(userId) {
  const row = sql().prepare('SELECT username FROM lastfm WHERE user_id = ?').get(userId);

  return row?.username ?? null;
}

export async function setUser(userId, username) {
  sql()
    .prepare(`
      INSERT INTO lastfm (user_id, username) VALUES (?, ?)
      ON CONFLICT (user_id) DO UPDATE SET username = excluded.username
    `)
    .run(userId, username);

  return username;
}

/** the layout and the reactions a person asked for. */
export function style(userId) {
  const row = sql().prepare('SELECT template, reactions FROM fm WHERE user_id = ?').get(userId);

  return {
    template: row?.template || defaultTemplate,
    reactions: row ? JSON.parse(row.reactions) : [],
  };
}

export function setStyle(userId, patch) {
  const current = style(userId);

  sql()
    .prepare(`
      INSERT INTO fm (user_id, template, reactions) VALUES (?, ?, ?)
      ON CONFLICT (user_id) DO UPDATE SET template = excluded.template, reactions = excluded.reactions
    `)
    .run(userId, patch.template ?? current.template, JSON.stringify(patch.reactions ?? current.reactions));

  return style(userId);
}

/** the track this user has on right now, or the last one they finished. */
export async function recent(username) {
  const data = await call('user.getrecenttracks', { user: username, limit: 1 });
  const track = data?.recenttracks?.track?.[0];

  if (!track) return null;

  return {
    playing: track['@attr']?.nowplaying === 'true',
    track: track.name,
    artist: track.artist?.['#text'] ?? track.artist?.name ?? '',
    album: track.album?.['#text'] ?? '',
    art: track.image?.at(-1)?.['#text'] || null,
    url: track.url ?? null,
  };
}

/** how many times this person played one artist, or null when last.fm has none. */
export async function artistPlays(username, artist) {
  const data = await call('artist.getinfo', { artist, username });
  const plays = Number(data?.artist?.stats?.userplaycount ?? 0);

  return { plays: Number.isFinite(plays) ? plays : 0, name: data?.artist?.name ?? artist };
}

/** the albums somebody plays most, with cover art, for a chart. */
export async function topAlbums(username, period = '7day', limit = 25) {
  const data = await call('user.gettopalbums', { user: username, period, limit: String(limit) });

  return (data?.topalbums?.album ?? []).map((album) => ({
    name: album.name,
    artist: album.artist?.name ?? '',
    plays: Number(album.playcount ?? 0),
    art: album.image?.at(-1)?.['#text'] || null,
  }));
}

/** the artist somebody listens to most. */
export async function topArtist(username) {
  const data = await call('user.gettopartists', { user: username, period: 'overall', limit: 1 });
  const artist = data?.topartists?.artist?.[0];

  if (!artist) return null;

  return { artist: artist.name, plays: Number(artist.playcount ?? 0) };
}

/** crown cache: twelve hours is plenty for a chart nobody checks hourly. */
const crownLife = 12 * 60 * 60 * 1000;

export function crown(userId) {
  const row = sql().prepare('SELECT crown, crown_plays, crown_at FROM fm WHERE user_id = ?').get(userId);

  if (!row?.crown) return null;
  if (Date.now() - row.crown_at > crownLife) return null;

  return { artist: row.crown, plays: row.crown_plays, at: row.crown_at };
}

export function rememberCrown(userId, { artist, plays }) {
  sql()
    .prepare(`
      INSERT INTO fm (user_id, crown, crown_plays, crown_at) VALUES (?, ?, ?, ?)
      ON CONFLICT (user_id) DO UPDATE SET crown = excluded.crown, crown_plays = excluded.crown_plays, crown_at = excluded.crown_at
    `)
    .run(userId, artist, plays, Date.now());

  return { artist, plays, at: Date.now() };
}

/** everyone with a username, so a chart can be built without scanning members. */
export const everyone = () => sql().prepare('SELECT user_id, username FROM lastfm').all();
