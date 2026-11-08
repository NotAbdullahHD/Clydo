import { Events, PermissionFlagsBits } from 'discord.js';
import { emoji } from './emoji.js';
import { simple } from './card.js';
import { cached } from './config.js';
import { prefix } from './prefix.js';
import { palette } from './theme.js';

/**
 * automod, lite.
 *
 * three things that are always the same three things: invite links, one person
 * posting faster than a person reads, and a message shouted in caps. the action
 * is always the same too — delete it and say why in one line. staff are never
 * touched, because the person who needs the rule least is the person enforcing it.
 */

const key = 'automod';

export const blank = () => ({ invites: true, spam: true, caps: true });

export function settings(guildId) {
  return { ...blank(), ...(cached(guildId, key) ?? {}) };
}

const invite = /(?:discord\.gg|discord(?:app)?\.com\/invite)\/[\w-]+/i;

const window = 5_000;
const burst = 5;
const seen = new Map();
const capsize = 2_000;

/** share of letters that are upper case. digits and emoji do not count. */
function shouty(content) {
  const letters = content.replace(/[^a-z]/gi, '');
  if (!letters.length) return 0;

  return letters.replace(/[^A-Z]/g, '').length / letters.length;
}

function tooFast(guildId, userId) {
  const id = `${guildId}:${userId}`;
  const now = Date.now();
  const times = (seen.get(id) ?? []).filter((at) => now - at < window);

  times.push(now);
  seen.set(id, times);

  if (seen.size > capsize) seen.delete(seen.keys().next().value);

  return times.length > burst;
}

export function watch(client) {
  client.on(Events.MessageCreate, async (message) => {
    try {
      if (!message.guild || message.author.bot) return;

      const content = message.content ?? '';
      if (!content || content.startsWith(prefix)) return;
      if (message.member?.permissions.has(PermissionFlagsBits.ManageMessages)) return;

      const state = settings(message.guild.id);
      let reason = null;

      if (state.invites && invite.test(content)) reason = 'invite links are not allowed here.';
      else if (state.caps && content.length >= 12 && shouty(content) > 0.7) reason = 'less caps, please.';
      else if (state.spam && tooFast(message.guild.id, message.author.id)) reason = 'slow down a little.';

      if (!reason) return;

      await message.delete().catch(() => {});

      const sent = await message.channel
        .send({
          ...simple({ accent: palette.warn, message: `${emoji.warning} <@${message.author.id}> ${reason}` }),
          allowedMentions: { parse: [] },
        })
        .catch(() => null);

      if (sent) setTimeout(() => sent.delete().catch(() => {}), 5_000);
    } catch (error) {
      console.warn('[slink] automod skipped —', error?.message ?? error);
    }
  });
}
