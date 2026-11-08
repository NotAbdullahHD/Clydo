import { Events } from 'discord.js';
import { heading, payload, quiet, rule, shell, text } from './card.js';
import { cached, set } from './config.js';

/**
 * welcome and leave.
 *
 * any number of channels can carry the cards, each with its own timer and its
 * own choice about mentioning the member. placeholders keep the sentence
 * reusable — `{user}` mentions, `{name}` is the username, `{server}` the guild,
 * `{count}` the member count.
 */

const key = 'welcome';

export const defaults = {
  join: 'welcome {user} — you are member {count}.',
  leave: '{name} left. member {count} now.',
};

export const blank = () => ({ channels: [], texts: { ...defaults } });

export function settings(guildId) {
  const saved = cached(guildId, key) ?? {};
  const state = {
    channels: Array.isArray(saved.channels) ? saved.channels.map((entry) => ({
      channelId: entry.channelId,
      selfDestruct: Number(entry.selfDestruct) || 0,
      pingable: Boolean(entry.pingable),
    })) : [],
    texts: { ...defaults, ...(saved.texts ?? {}) },
  };

  // the first pass kept one channel per card and one sentence each.
  if (!state.channels.length) {
    const seen = new Set();

    for (const entry of [saved.join, saved.leave]) {
      if (!entry?.channelId || seen.has(entry.channelId)) continue;
      seen.add(entry.channelId);
      state.channels.push({ channelId: entry.channelId, selfDestruct: 0, pingable: false });
    }
  }

  if (saved.join?.message) state.texts.join = saved.join.message;
  if (saved.leave?.message) state.texts.leave = saved.leave.message;

  return state;
}

export const save = (guildId, change) => set(guildId, key, { ...settings(guildId), ...change });

export function add(guildId, { channelId, selfDestruct = 0, pingable = false }) {
  const state = settings(guildId);
  const seconds = Math.min(600, Math.max(0, Math.floor(Number(selfDestruct) || 0)));

  return save(guildId, {
    channels: [
      ...state.channels.filter((entry) => entry.channelId !== channelId),
      { channelId, selfDestruct: seconds, pingable: Boolean(pingable) },
    ],
  });
}

export function removeChannel(guildId, channelId) {
  const state = settings(guildId);

  return save(guildId, {
    channels: state.channels.filter((entry) => entry.channelId !== channelId),
  });
}

export function fill(template, member) {
  return String(template)
    .replaceAll('{user}', `<@${member.id}>`)
    .replaceAll('{name}', member.user?.username ?? 'someone')
    .replaceAll('{server}', member.guild.name)
    .replaceAll('{count}', String(member.guild.memberCount));
}

export function card(member, { title, note, message, foot = null }) {
  const box = shell();
  heading(box, {
    title,
    note,
    avatar: member.user?.displayAvatarURL({ size: 256 }),
  });
  box.addSeparatorComponents(rule());
  box.addTextDisplayComponents(text(fill(message, member)));
  if (foot) box.addTextDisplayComponents(quiet(foot));

  return payload(box);
}

const resolve = async (guild, channelId) => guild.channels.cache.get(channelId)
  ?? guild.channels.fetch(channelId).catch(() => null);

async function deliver(guild, state, { title, message, member, foot }) {
  for (const entry of state.channels) {
    const channel = await resolve(guild, entry.channelId);
    if (!channel?.isTextBased?.()) continue;

    const sent = await channel
      .send({
        ...card(member, { title, note: `${guild.name} · member ${guild.memberCount}`, message, foot }),
        allowedMentions: entry.pingable ? { parse: ['users'] } : { parse: [] },
      })
      .catch(() => null);

    if (sent && entry.selfDestruct > 0) {
      setTimeout(() => sent.delete().catch(() => {}), entry.selfDestruct * 1000);
    }
  }
}

export function watch(client) {
  client.on(Events.GuildMemberAdd, async (member) => {
    const state = settings(member.guild.id);
    if (!state.channels.length) return;

    await deliver(member.guild, state, {
      title: 'welcome',
      message: state.texts.join,
      member,
      foot: `joined <t:${Math.floor(Date.now() / 1000)}:R>`,
    });
  });

  client.on(Events.GuildMemberRemove, async (member) => {
    const state = settings(member.guild.id);
    if (!state.channels.length) return;

    await deliver(member.guild, state, {
      title: 'goodbye',
      message: state.texts.leave,
      member,
      foot: member.joinedTimestamp
        ? `was here <t:${Math.floor(member.joinedTimestamp / 1000)}:R>`
        : null,
    });
  });
}
