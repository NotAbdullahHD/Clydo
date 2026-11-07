import { panel } from './theme.js';

/**
 * gif expressions — one api, one fallback list per action, one reply shape.
 *
 * nekos.best is fast and needs no key, but it is somebody else's service: if it
 * is slow, rate limited or down, the local list keeps the command working. the
 * urls below were pulled from it, so they are the same assets it would serve.
 */

const endpoint = 'https://nekos.best/api/v2';
const timeout = 2500;

const actions = Object.freeze({
  cry: { verb: 'cries' },
  pout: { verb: 'pouts' },
  blush: { verb: 'blushes' },
  dance: { verb: 'dances' },
  hug: { verb: 'hugs', target: true },
  slap: { verb: 'slaps', target: true },
  pat: { verb: 'pats', target: true },
  kiss: { verb: 'kisses', target: true },
  highfive: { verb: 'high-fives', target: true },
});

export const names = Object.keys(actions);

const fallbacks = Object.freeze({
  cry: [
    'https://nekos.best/api/v2/cry/c7db06f0-95de-4d25-ac19-c9c30ec10bc2.gif',
    'https://nekos.best/api/v2/cry/c4427cbf-9d5a-4e45-955a-66e7bebe2593.gif',
  ],
  pout: [
    'https://nekos.best/api/v2/pout/36c2f0ac-9254-42cd-b12f-3318fadbc560.gif',
    'https://nekos.best/api/v2/pout/6eb39503-7489-48a5-9e9c-ec0c61157e06.gif',
  ],
  blush: [
    'https://nekos.best/api/v2/blush/9c327c6b-1f63-4166-9c31-8e769e135df0.gif',
    'https://nekos.best/api/v2/blush/5e23a75a-fcea-4b98-8880-acecb9ead960.gif',
  ],
  dance: [
    'https://nekos.best/api/v2/dance/2cc51c2d-745c-4e6e-866d-80d01f31712e.gif',
    'https://nekos.best/api/v2/dance/8fae6617-3dd8-4711-841a-1bd406e55237.gif',
  ],
  hug: [
    'https://nekos.best/api/v2/hug/548daa04-3dff-4524-bb28-c229e5542e9f.gif',
    'https://nekos.best/api/v2/hug/40142a6f-83c4-450e-a477-ca7c89787623.gif',
  ],
  slap: [
    'https://nekos.best/api/v2/slap/0ab9558a-e9ac-4fd6-92a1-c66c804c8e5d.gif',
    'https://nekos.best/api/v2/slap/1eee3d71-22f0-46bc-955d-051531235649.gif',
  ],
  pat: [
    'https://nekos.best/api/v2/pat/9b29a573-4795-4bb5-89b4-23146bd06da4.gif',
    'https://nekos.best/api/v2/pat/7367dc29-c526-4627-bcb7-36466bb5331c.gif',
  ],
  kiss: [
    'https://nekos.best/api/v2/kiss/982258bf-933a-4713-8964-614905e48864.gif',
    'https://nekos.best/api/v2/kiss/d9ca261b-6b8c-4bef-8d3e-3e172a86e16a.gif',
  ],
  highfive: [
    'https://nekos.best/api/v2/highfive/f6ef8fe9-b921-45ad-938d-c14a80371df0.gif',
    'https://nekos.best/api/v2/highfive/04825fb0-9e88-47a6-a4a6-0ca476c75101.gif',
  ],
});

/** the last url per action, so the same gif does not land twice in a row. */
const recent = new Map();

const pick = (list) => list[Math.floor(Math.random() * list.length)] ?? null;

/** one gif url for an action, from the api when it answers, otherwise local. */
export async function fetchGif(action) {
  if (!actions[action]) return null;

  try {
    // no custom user-agent: nekos.best sits behind cloudflare and answers a
    // scripted ua with 403, while a plain request gets the json.
    const response = await fetch(`${endpoint}/${action}?amount=3`, {
      signal: AbortSignal.timeout(timeout),
    });

    if (!response.ok) throw new Error(`nekos.best ${response.status}`);

    const body = await response.json();
    const urls = (body?.results ?? [])
      .map((result) => result?.url)
      .filter((url) => typeof url === 'string' && url.startsWith('https://'));

    const fresh = urls.filter((url) => url !== recent.get(action));
    const pool = fresh.length ? fresh : urls;

    if (!pool.length) throw new Error('no results');

    const url = pick(pool);
    recent.set(action, url);
    return url;
  } catch (error) {
    console.warn(`[slink] ${action} gif — ${error?.message ?? error}`);
    return pick(fallbacks[action] ?? []);
  }
}

/** reply with the gif and the sentence. */
export async function expression(message, action) {
  const meta = actions[action];

  if (!meta || !message.guild) return;

  const target = meta.target ? (message.mentions.users.first() ?? message.client.user) : null;
  const url = await fetchGif(action);

  const line = !target
    ? `${message.author.username} ${meta.verb}`
    : target.id === message.author.id
      ? `${message.author.username} ${meta.verb} themselves`
      : `${message.author.username} ${meta.verb} ${target.username}`;

  const embed = panel({ description: line });
  if (url) embed.setImage(url);

  await message.reply({ embeds: [embed], allowedMentions: { parse: [] } });
}
