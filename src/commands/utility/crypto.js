import { panel, section, sections } from '../../lib/theme.js';

/** shorthand → coingecko id. raw coingecko ids work too. */

const symbols = Object.freeze({
  btc: 'bitcoin',
  eth: 'ethereum',
  sol: 'solana',
  xrp: 'ripple',
  bnb: 'binancecoin',
  doge: 'dogecoin',
  ada: 'cardano',
  trx: 'tron',
  avax: 'avalanche-2',
  link: 'chainlink',
  dot: 'polkadot',
  matic: 'matic-network',
  ltc: 'litecoin',
  bch: 'bitcoin-cash',
  xmr: 'monero',
  sui: 'sui',
  apt: 'aptos',
  near: 'near',
  arb: 'arbitrum',
  op: 'optimism',
  atom: 'cosmos',
  ton: 'the-open-network',
  shib: 'shiba-inu',
  pepe: 'pepe',
  hype: 'hyperliquid',
  usdt: 'tether',
  usdc: 'usd-coin',
});

export const name = 'crypto';

const cacheMs = 30_000;
let cache = { key: '', at: 0, data: null };

const money = (value) => {
  const digits = value >= 1 ? 2 : value >= 0.01 ? 4 : 8;
  const text = value.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  return `$${text}`;
};

const change = (value) => `${value >= 0 ? '+' : '-'}${Math.abs(value).toFixed(2)}%`;

async function quote(ids) {
  const key = ids.join(',');

  if (cache.key === key && Date.now() - cache.at < cacheMs) return cache.data;

  const url = new URL('https://api.coingecko.com/api/v3/simple/price');
  url.searchParams.set('ids', key);
  url.searchParams.set('vs_currencies', 'usd');
  url.searchParams.set('include_24hr_change', 'true');

  const response = await fetch(url, {
    signal: AbortSignal.timeout(8000),
    headers: { accept: 'application/json' },
  });

  if (!response.ok) throw new Error(`coingecko responded ${response.status}`);

  const data = await response.json();
  cache = { key, at: Date.now(), data };
  return data;
}

export async function prefix(message, args) {
  const requested = (args.join(' ') || 'btc eth')
    .toLowerCase()
    .split(/[\s,]+/)
    .filter(Boolean);

  const wanted = [...new Set(requested)].slice(0, 5);
  const ids = wanted.map((symbol) => symbols[symbol] ?? symbol);

  const prices = await quote(ids);
  const groups = [];
  const missing = [];

  wanted.forEach((symbol, index) => {
    const entry = prices[ids[index]];
    if (!entry?.usd) {
      missing.push(symbol);
      return;
    }

    const rows = [['price', money(entry.usd)]];
    if (typeof entry.usd_24h_change === 'number') {
      rows.push(['24h', change(entry.usd_24h_change)]);
    }

    groups.push(section({ heading: symbol, rows }));
  });

  if (missing.length) {
    groups.push(section({ heading: 'not tracked', rows: missing.map((symbol) => [symbol, 'no quote']) }));
  }

  if (groups.length === 0 || wanted.length === missing.length) {
    await message.reply({
      embeds: [
        panel({
          title: 'crypto',
          description: section({
            heading: 'nothing quoted',
            rows: [['try', Object.keys(symbols).slice(0, 8).join(' ')]],
          }),
          footer: 'or pass a coingecko id',
        }),
      ],
    });
    return;
  }

  const stamp = new Date().toISOString().slice(11, 16);

  await message.reply({
    embeds: [
      panel({
        title: 'crypto',
        description: sections(...groups),
        footer: `usd spot  •  ${stamp} utc`,
      }),
    ],
  });
}
