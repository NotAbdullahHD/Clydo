import { PermissionFlagsBits } from 'discord.js';
import { set } from '../../lib/config.js';
import { settings } from '../../lib/logging.js';
import { no, ok } from '../../lib/line.js';

/**
 * `,modlog [#channel|off]` — moderation and member events in one place.
 */

export const name = 'modlog';
export const names = ['modlogs'];

const kinds = ['moderation', 'members'];

export async function prefix(message, args) {
  if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
    await message.reply(no('this needs **manage server**.'));
    return;
  }

  const state = settings(message.guildId);
  const channel = message.mentions.channels.first() ?? null;
  const off = (args[0] ?? '').toLowerCase() === 'off';

  if (!channel && !off) {
    await message.reply(ok(message, kinds
      .map((kind) => `**${kind}** → ${state.routes[kind] ? `<#${state.routes[kind]}>` : 'off'}`)
      .join(' · ')));
    return;
  }

  const routes = { ...state.routes };

  for (const kind of kinds) {
    if (off) delete routes[kind];
    else routes[kind] = channel.id;
  }

  set(message.guildId, 'logging', { ...state, routes });

  await message.reply(ok(message, off ? 'mod logs are off.' : `mod logs go to <#${channel.id}>.`));
}
