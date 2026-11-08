import { Events } from 'discord.js';
import { heading, payload, rule, shell, text } from './card.js';
import { cached } from './config.js';

/**
 * welcome and leave.
 *
 * one card each: the member's face, the server's name, and whatever sentence the
 * staff wrote. placeholders keep the sentence reusable — `{user}` mentions,
 * `{name}` is the username, `{server}` the guild, `{count}` the member count.
 */

const key = 'welcome';

export const defaults = {
  join: { channelId: null, message: 'welcome {user} — you are member {count}.' },
  leave: { channelId: null, message: '{name} left. member {count} now.' },
};

export function settings(guildId) {
  const saved = cached(guildId, key) ?? {};

  return {
    join: { ...defaults.join, ...(saved.join ?? {}) },
    leave: { ...defaults.leave, ...(saved.leave ?? {}) },
  };
}

export function fill(template, member) {
  return String(template)
    .replaceAll('{user}', `<@${member.id}>`)
    .replaceAll('{name}', member.user?.username ?? 'someone')
    .replaceAll('{server}', member.guild.name)
    .replaceAll('{count}', String(member.guild.memberCount));
}

export function card(member, { title, note, message }) {
  const box = shell();
  heading(box, {
    title,
    note,
    avatar: member.user?.displayAvatarURL({ size: 256 }),
  });
  box.addSeparatorComponents(rule());
  box.addTextDisplayComponents(text(fill(message, member)));

  return payload(box);
}

export function watch(client) {
  client.on(Events.GuildMemberAdd, async (member) => {
    const state = settings(member.guild.id);
    if (!state.join.channelId) return;

    const channel = member.guild.channels.cache.get(state.join.channelId);
    if (!channel?.isTextBased?.()) return;

    await channel
      .send({
        ...card(member, {
          title: 'welcome',
          note: `${member.guild.name} · member ${member.guild.memberCount}`,
          message: state.join.message,
        }),
        allowedMentions: { parse: [] },
      })
      .catch(() => {});
  });

  client.on(Events.GuildMemberRemove, async (member) => {
    const state = settings(member.guild.id);
    if (!state.leave.channelId) return;

    const channel = member.guild.channels.cache.get(state.leave.channelId);
    if (!channel?.isTextBased?.()) return;

    await channel
      .send({
        ...card(member, {
          title: 'goodbye',
          note: `${member.guild.name} · member ${member.guild.memberCount}`,
          message: state.leave.message,
        }),
        allowedMentions: { parse: [] },
      })
      .catch(() => {});
  });
}
