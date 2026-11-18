import { PermissionFlagsBits } from 'discord.js';
import { set } from '../../lib/config.js';
import { settings } from '../../lib/logging.js';
import { no, ok } from '../../lib/line.js';

/**
 * `,messagelog [#channel|off]` — deleted and edited messages, nothing else.
 */

export const name = 'messagelog';
export const names = ['msglog'];

export async function prefix(message, args) {
  if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
    await message.reply(no('this needs **manage server**.'));
    return;
  }

  const state = settings(message.guildId);
  const channel = message.mentions.channels.first() ?? null;
  const off = (args[0] ?? '').toLowerCase() === 'off';

  if (!channel && !off) {
    await message.reply(ok(message, `**messages** → ${state.routes.messages ? `<#${state.routes.messages}>` : 'off'}`));
    return;
  }

  const routes = { ...state.routes };

  if (off) delete routes.messages;
  else routes.messages = channel.id;

  set(message.guildId, 'logging', { ...state, routes });

  await message.reply(ok(message, off ? 'message logs are off.' : `message logs go to <#${channel.id}>.`));
}
