import { PermissionFlagsBits } from 'discord.js';
import { facts, heading, payload, rule, shell, simple } from '../../lib/card.js';
import { patch } from '../../lib/config.js';
import { settings } from '../../lib/starboard.js';
import { palette } from '../../lib/theme.js';

/**
 * `,starboard #channel` — the message hall of fame.
 */

export const name = 'starboard';
export const names = ['star'];

const usage = 'usage — `,starboard #channel`, `,starboard threshold 1-25`, `,starboard emoji <emoji>`, `,starboard off`';

async function status(message) {
  const state = settings(message.guild.id);

  const box = shell();
  heading(box, { title: 'starboard', note: state.channelId ? 'on' : 'off' });
  box.addSeparatorComponents(rule());
  box.addTextDisplayComponents(facts([
    ['channel', state.channelId ? `<#${state.channelId}>` : 'none'],
    ['threshold', String(state.threshold)],
    ['emoji', state.emoji],
  ]));

  await message.reply({ ...payload(box), allowedMentions: { parse: [] } });
}

export async function prefix(message, args) {
  if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
    await message.reply(simple({ accent: palette.bad, title: 'starboard', message: 'you need manage server for that.' }));
    return;
  }

  const head = args[0]?.toLowerCase();
  const state = settings(message.guild.id);
  const channel = message.mentions.channels?.first?.() ?? null;

  if (!head) {
    await status(message);
    return;
  }

  if (head === 'off') {
    await patch(message.guild.id, 'starboard', { ...state, channelId: null });
    await message.reply(simple({ accent: palette.good, title: 'starboard', message: 'starboard off.' }));
    return;
  }

  if (channel) {
    await patch(message.guild.id, 'starboard', { ...state, channelId: channel.id });
    await message.reply(simple({ accent: palette.good, title: 'starboard', message: `stars land in <#${channel.id}>.` }));
    return;
  }

  if (head === 'threshold') {
    const value = Number(args[1]);

    if (!Number.isInteger(value) || value < 1 || value > 25) {
      await message.reply(simple({ accent: palette.bad, title: 'starboard', message: 'threshold is a whole number from 1 to 25.' }));
      return;
    }

    await patch(message.guild.id, 'starboard', { ...state, threshold: value });
    await message.reply(simple({ accent: palette.good, title: 'starboard', message: `a message needs ${value} ${state.emoji} to land.` }));
    return;
  }

  if (head === 'emoji') {
    const raw = args[1];

    if (!raw) {
      await message.reply(simple({ accent: palette.bad, title: 'starboard', message: usage }));
      return;
    }

    const key = raw.match(/^<a?:\w+:(\d+)>$/)?.[1] ?? raw;

    await patch(message.guild.id, 'starboard', { ...state, emoji: key });
    await message.reply(simple({ accent: palette.good, title: 'starboard', message: `the star is now ${raw}.` }));
    return;
  }

  if (/^[a-z]+$/.test(head)) {
    await message.reply(simple({ accent: palette.bad, title: 'starboard', message: usage }));
    return;
  }

  await status(message);
}
