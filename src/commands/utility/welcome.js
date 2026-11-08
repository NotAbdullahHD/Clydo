import { PermissionFlagsBits } from 'discord.js';
import { facts, heading, payload, quiet, rule, shell, simple } from '../../lib/card.js';
import { patch } from '../../lib/config.js';
import { card, settings } from '../../lib/welcome.js';
import { palette } from '../../lib/theme.js';

/**
 * `,welcome #channel` — the join and leave cards.
 */

export const name = 'welcome';

const maxText = 400;

const usage = 'usage — `,welcome #channel`, `,welcome leave #channel`, `,welcome message <text>`, `,welcome leave message <text>`, `,welcome test`, `,welcome off`';

async function status(message) {
  const state = settings(message.guild.id);

  const box = shell();
  heading(box, { title: 'welcome', note: 'join and leave' });
  box.addSeparatorComponents(rule());
  box.addTextDisplayComponents(facts([
    ['join', state.join.channelId ? `<#${state.join.channelId}>` : 'off'],
    ['leave', state.leave.channelId ? `<#${state.leave.channelId}>` : 'off'],
    ['join text', state.join.message],
    ['leave text', state.leave.message],
  ]));
  box.addTextDisplayComponents(quiet('placeholders — {user} {name} {server} {count}'));

  await message.reply({ ...payload(box), allowedMentions: { parse: [] } });
}

export async function prefix(message, args) {
  if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
    await message.reply(simple({ accent: palette.bad, title: 'welcome', message: 'you need manage server for that.' }));
    return;
  }

  const head = args[0]?.toLowerCase();
  const leaving = head === 'leave';
  const rest = leaving ? args.slice(1) : args;
  const state = settings(message.guild.id);
  const channel = message.mentions.channels?.first?.() ?? null;

  const save = (join = null, left = null) => patch(message.guild.id, 'welcome', {
    join: { ...state.join, ...(join ?? {}) },
    leave: { ...state.leave, ...(left ?? {}) },
  });

  if (!head) {
    await status(message);
    return;
  }

  if (head === 'off') {
    await save({ channelId: null }, { channelId: null });
    await message.reply(simple({ accent: palette.good, title: 'welcome', message: 'join and leave cards are off.' }));
    return;
  }

  if (head === 'test') {
    await message.channel.send({
      ...card(message.member, {
        title: 'welcome',
        note: `${message.guild.name} · member ${message.guild.memberCount}`,
        message: state.join.message,
      }),
      allowedMentions: { parse: [] },
    });
    return;
  }

  if (rest[0]?.toLowerCase() === 'message') {
    const text = rest.slice(1).join(' ').trim();

    if (!text) {
      await message.reply(simple({ accent: palette.bad, title: 'welcome', message: usage }));
      return;
    }

    const value = text.slice(0, maxText);

    if (leaving) await save(null, { message: value });
    else await save({ message: value }, null);

    await message.reply(simple({
      accent: palette.good,
      title: 'welcome',
      message: `the ${leaving ? 'leave' : 'join'} message is now — ${value}`,
    }));
    return;
  }

  if (channel) {
    if (leaving) await save(null, { channelId: channel.id });
    else await save({ channelId: channel.id }, null);

    await message.reply(simple({
      accent: palette.good,
      title: 'welcome',
      message: `${leaving ? 'goodbye' : 'welcome'} cards go to <#${channel.id}>.`,
    }));
    return;
  }

  if (kindsGuard(head)) {
    await message.reply(simple({ accent: palette.bad, title: 'welcome', message: usage }));
    return;
  }

  await status(message);
}

/** anything that is not a known option is a usage error, not a silent status. */
function kindsGuard(head) {
  return !['join', 'leave', 'test', 'off', 'message'].includes(head) && /^[a-z]+$/.test(head);
}
