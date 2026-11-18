import { Events } from 'discord.js';
import { heading, payload, quiet, rule, shell, text } from './card.js';
import { cached, set } from './config.js';
import { render, script } from './embedBuilder.js';
import { no, ok } from './line.js';
import { panel } from './theme.js';

/**
 * welcome, leave and boost.
 *
 * any number of channels can carry the cards, each with its own timer and its
 * own choice about mentioning the member. a channel can hold a plain sentence
 * or a `{embed}` script — both take the same placeholders, so `{user}` mentions,
 * `{name}` is the username, `{server}` the guild, `{count}` the member count.
 */

const key = 'welcome';

export const defaults = {
  join: 'welcome {user} — you are member {count}.',
  leave: '{name} left. member {count} now.',
  boost: '{user} just boosted — thank you.',
};

export const blank = () => ({
  channels: [],
  texts: { ...defaults },
  scripts: { join: null, leave: null, boost: null },
});

export function settings(guildId) {
  const saved = cached(guildId, key) ?? {};

  const state = {
    channels: Array.isArray(saved.channels) ? saved.channels.map((entry) => ({
      channelId: entry.channelId,
      selfDestruct: Number(entry.selfDestruct) || 0,
      pingable: Boolean(entry.pingable),
    })) : [],
    texts: { ...defaults, ...(saved.texts ?? {}) },
    scripts: { ...blank().scripts, ...(saved.scripts ?? {}) },
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

const looks = {
  join: { title: 'welcome', text: 'join', foot: (member) => `joined <t:${Math.floor(Date.now() / 1000)}:R>` },
  leave: { title: 'goodbye', text: 'leave', foot: (member) => (member.joinedTimestamp ? `was here <t:${Math.floor(member.joinedTimestamp / 1000)}:R>` : null) },
  boost: { title: 'boost', text: 'boost', foot: () => 'thank you' },
};

/** the payload for one card: a script when there is one, the plain card otherwise. */
export function body(state, kind, member) {
  const look = looks[kind] ?? looks.join;
  const saved = state.scripts?.[kind];

  if (saved) {
    const result = render(member, saved);

    if (result.payload) return result.payload;

    console.warn('[slink] welcome — script rejected:', result.problem);
  }

  return card(member, {
    title: look.title,
    note: `${member.guild.name} · member ${member.guild.memberCount}`,
    message: state.texts[look.text],
    foot: look.foot(member),
  });
}

async function deliver(guild, state, kind, member) {
  for (const entry of state.channels) {
    const channel = await resolve(guild, entry.channelId);
    if (!channel?.isTextBased?.()) continue;

    const sent = await channel
      .send({
        ...body(state, kind, member),
        allowedMentions: entry.pingable ? { parse: ['users'] } : { parse: [] },
      })
      .catch(() => null);

    if (sent && entry.selfDestruct > 0) {
      const timer = setTimeout(() => sent.delete().catch(() => {}), entry.selfDestruct * 1000);
      timer.unref?.();
    }
  }
}

export function watch(client) {
  client.on(Events.GuildMemberAdd, async (member) => {
    const state = settings(member.guild.id);
    if (!state.channels.length) return;

    await deliver(member.guild, state, 'join', member);
  });

  client.on(Events.GuildMemberRemove, async (member) => {
    const state = settings(member.guild.id);
    if (!state.channels.length) return;

    await deliver(member.guild, state, 'leave', member);
  });

  client.on(Events.GuildMemberUpdate, async (before, after) => {
    if (before.premiumSince || !after.premiumSince) return;

    const state = settings(after.guild.id);
    if (!state.channels.length) return;

    await deliver(after.guild, state, 'boost', after);
  });
}

/** `,welcome`, `,leave` and `,boost` — the same management in three names. */
export async function manage(message, args, kind) {
  const state = settings(message.guildId);
  const look = looks[kind] ?? looks.join;
  const head = (args[0] ?? '').toLowerCase();
  const channel = message.mentions.channels.first() ?? null;

  if (head === 'off') {
    if (kind === 'boost') {
      save(message.guildId, { scripts: { ...state.scripts, boost: null } });
    } else {
      save(message.guildId, { channels: [], scripts: { ...state.scripts, [kind]: null } });
    }

    await message.reply(ok(message, `${look.text} messages are off.`));
    return;
  }

  if (head === 'text' || head === 'script' || head === 'set') {
    const body = args.slice(1).join(' ').trim();

    if (!body) {
      await message.reply(no(`usage: \`,${kind === 'join' ? 'welcome' : kind} text {embed}$v{title: welcome {user.name}}\``));
      return;
    }

    if (!/\{embed\}/i.test(body)) {
      // a plain sentence is a legitimate script: keep it and say so.
      save(message.guildId, { scripts: { ...state.scripts, [kind]: body } });
      await message.reply(ok(message, `${look.text} message saved as plain text.`));
      return;
    }

    const parsed = script(body);
    if (parsed.problem) {
      await message.reply(no(parsed.problem));
      return;
    }

    save(message.guildId, { scripts: { ...state.scripts, [kind]: body } });
    await message.reply(ok(message, `${look.text} script saved.`));
    return;
  }

  if (head === 'test') {
    await message.reply(body(settings(message.guildId), kind, message.member));
    return;
  }

  if (head === 'remove' && channel) {
    removeChannel(message.guildId, channel.id);
    await message.reply(ok(message, `<#${channel.id}> no longer gets ${look.text} messages.`));
    return;
  }

  if (channel) {
    add(message.guildId, { channelId: channel.id });
    await message.reply(ok(message, `${look.text} messages go to <#${channel.id}>.`));
    return;
  }

  const current = settings(message.guildId);

  await message.reply({
    embeds: [panel({
      title: look.text === 'goodbye' ? 'leave' : look.text,
      description: [
        `\`›\` channels  •  ${current.channels.length ? current.channels.map((entry) => `<#${entry.channelId}>`).join(' ') : 'none'}`,
        `\`›\` message  •  ${current.scripts?.[kind] ? 'script' : 'plain'}`,
        `\`›\` script  •  ${(current.scripts?.[kind] ?? current.texts[look.text]).slice(0, 120)}`,
      ].join('\n'),
      footer: `\`,${kind === 'join' ? 'welcome' : kind} #channel\`  ·  \`,${kind === 'join' ? 'welcome' : kind} text <script>\`  ·  test`,
    })],
    allowedMentions: { parse: [] },
  });
}
