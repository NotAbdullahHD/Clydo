import { MessageFlags } from 'discord.js';
import { emoji } from './emoji.js';
import { simple } from './card.js';
import { palette } from './theme.js';

/**
 * the receipt.
 *
 * a setting that changed is one line, never a card: a mark, who did it, and the
 * new value. plain content rather than an embed, because an embed for one
 * sentence is the exact bulk this bot exists to avoid.
 *
 * `done` and `oops` stay for the flows that need a coloured surface; the new
 * helpers are what commands should reach for first.
 */

const actor = (source) => source?.user?.id ?? source?.author?.id ?? null;

/** plain content, no mentions resolved. */
export const say = (text) => ({ content: String(text ?? ''), allowedMentions: { parse: [] } });

/** a tick, the person, and what happened. */
export function ok(source, text) {
  const id = actor(source);
  return say(`${emoji.check}${id ? ` <@${id}>:` : ''} ${text}`);
}

/** a cross and the reason, in the same shape. */
export function no(text) {
  return say(`${emoji.cross} ${text}`);
}

/** a quiet aside, small and grey. */
export const aside = (text) => say(`-# ${text}`);

/** send a receipt and swallow a deleted channel. */
export const tell = (message, payload) => message.reply(payload).catch(() => null);

export const done = (source, text) => simple({
  accent: palette.good,
  message: `${emoji.check} <@${actor(source)}>: ${text}`,
});

export const oops = (text) => simple({ accent: palette.bad, message: text });

export const ephemeral = (payload) => ({
  ...payload,
  flags: (Number(payload.flags) || 0) | MessageFlags.Ephemeral,
});
