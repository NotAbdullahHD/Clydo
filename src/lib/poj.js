import { Events } from 'discord.js';
import { cached, set } from './config.js';

/**
 * ping on join.
 *
 * a new member is mentioned in the configured channel and the line is deleted a
 * few seconds later — the ghost ping people ask for. the mention is the whole
 * point, so the payload allows user pings and nothing else, and the delete is
 * scheduled straight after the send so a restart cannot leave the line behind
 * forever in the common case.
 */

const key = 'poj';

export const limits = { min: 1, max: 60, fallback: 5 };

export const clamp = (value) => {
  const seconds = Math.floor(Number(value));

  return seconds >= limits.min && seconds <= limits.max ? seconds : limits.fallback;
};

export const blank = () => ({ channels: [] });

export function settings(guildId) {
  const saved = cached(guildId, key) ?? {};

  return {
    channels: (Array.isArray(saved.channels) ? saved.channels : [])
      .filter((entry) => entry?.channelId)
      .map((entry) => ({ channelId: String(entry.channelId), delay: clamp(entry.delay) })),
  };
}

export const save = (guildId, change) => set(guildId, key, { ...settings(guildId), ...change });

export function add(guildId, { channelId, delay }) {
  const state = settings(guildId);

  return save(guildId, {
    channels: [
      ...state.channels.filter((entry) => entry.channelId !== channelId),
      { channelId, delay: clamp(delay) },
    ],
  });
}

export function removeChannel(guildId, channelId) {
  const state = settings(guildId);

  return save(guildId, {
    channels: state.channels.filter((entry) => entry.channelId !== channelId),
  });
}

/** the one line a join leaves behind, briefly. */
export const line = (member) => `welcome in <@${member.id}>`;

const resolve = async (guild, channelId) => guild.channels.cache.get(channelId)
  ?? guild.channels.fetch(channelId).catch(() => null);

export function watch(client) {
  client.on(Events.GuildMemberAdd, async (member) => {
    try {
      const state = settings(member.guild.id);
      if (!state.channels.length) return;

      for (const entry of state.channels) {
        const channel = await resolve(member.guild, entry.channelId);
        if (!channel?.isTextBased?.()) continue;

        const sent = await channel
          .send({ content: line(member), allowedMentions: { parse: ['users'] } })
          .catch(() => null);

        if (!sent) continue;

        setTimeout(() => sent.delete().catch(() => {}), entry.delay * 1000);
      }
    } catch (error) {
      console.warn('[slink] ping on join skipped —', error?.message ?? error);
    }
  });
}
