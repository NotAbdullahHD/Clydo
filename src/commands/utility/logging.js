import { PermissionFlagsBits } from 'discord.js';
import { facts, heading, payload, rule, shell, simple } from '../../lib/card.js';
import { set } from '../../lib/config.js';
import { blank, kinds, settings } from '../../lib/logging.js';
import { palette } from '../../lib/theme.js';

/**
 * `,logging #channel` — where the server writes things down.
 */

export const name = 'logging';

const usage = 'usage — `,logging #channel`, `,logging <messages|members|channels|roles> [on|off]`, `,logging off`';

async function status(message) {
  const state = settings(message.guild.id);

  const box = shell();
  heading(box, { title: 'logging', note: state.channelId ? 'on' : 'off' });
  box.addSeparatorComponents(rule());
  box.addTextDisplayComponents(facts([
    ['channel', state.channelId ? `<#${state.channelId}>` : 'none'],
    ...kinds.map((kind) => [kind, state[kind] ? 'on' : 'off']),
  ]));

  await message.reply({ ...payload(box), allowedMentions: { parse: [] } });
}

export async function prefix(message, args) {
  if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
    await message.reply(simple({ accent: palette.bad, title: 'logging', message: 'you need manage server for that.' }));
    return;
  }

  const head = args[0]?.toLowerCase();
  const channel = message.mentions.channels?.first?.() ?? null;
  const current = settings(message.guild.id);

  if (!head) {
    await status(message);
    return;
  }

  if (head === 'off') {
    await set(message.guild.id, 'logging', { ...current, channelId: null });
    await message.reply(simple({ accent: palette.good, title: 'logging', message: 'logging off.' }));
    return;
  }

  if (channel) {
    await set(message.guild.id, 'logging', { ...blank(), ...current, channelId: channel.id });
    await message.reply(simple({
      accent: palette.good,
      title: 'logging',
      message: `messages, members, channels and roles go to <#${channel.id}>.`,
    }));
    return;
  }

  if (kinds.includes(head)) {
    const on = args[1]?.toLowerCase() !== 'off';

    await set(message.guild.id, 'logging', { ...current, [head]: on });
    await message.reply(simple({
      accent: palette.good,
      title: 'logging',
      message: `${head} logging ${on ? 'on' : 'off'}.`,
    }));
    return;
  }

  await message.reply(simple({ accent: palette.bad, title: 'logging', message: usage }));
}
