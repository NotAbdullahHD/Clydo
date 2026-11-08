import { MessageFlags } from 'discord.js';
import { simple, V2 } from './card.js';
import { palette } from './theme.js';

/**
 * the receipt.
 *
 * a setting that changed is one line: a tick, who did it, and the new value in
 * code. cards are for things worth reading twice; this is not one of them.
 */

export const done = (source, text) => simple({
  accent: palette.good,
  message: `✅ <@${source?.user?.id ?? source?.author?.id}>: ${text}`,
});

export const oops = (text) => simple({ accent: palette.bad, message: text });

export const ephemeral = (card) => ({
  ...card,
  flags: (Number(card.flags) || 0) | V2 | MessageFlags.Ephemeral,
});
