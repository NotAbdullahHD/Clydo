import { PermissionFlagsBits } from 'discord.js';
import { no } from '../../lib/line.js';
import { manage } from '../../lib/welcome.js';

/**
 * `,welcome [#channel|text <script>|test|off]` — the join card.
 */

export const name = 'welcome';
export const names = ['greet'];

export async function prefix(message, args) {
  if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
    await message.reply(no('this needs **manage server**.'));
    return;
  }

  await manage(message, args, 'join');
}
