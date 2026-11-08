import { MessageFlags } from 'discord.js';
import { emoji } from './emoji.js';
import { simple } from './card.js';
import { palette } from './theme.js';

/**
 * the receipt.
 *
 * a setting that changed is one line: a tick, who did it, and the new value.
 * it is an ordinary embed, because a receipt is not a card.
 */

export const done = (source, text) => simple({
  accent: palette.good,
  message: `${emoji.check} <@${source?.user?.id ?? source?.author?.id}>: ${text}`,
});

export const oops = (text) => simple({ accent: palette.bad, message: text });

export const ephemeral = (payload) => ({
  ...payload,
  flags: (Number(payload.flags) || 0) | MessageFlags.Ephemeral,
});
