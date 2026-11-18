import { PermissionFlagsBits } from 'discord.js';
import { no } from '../../lib/line.js';
import { manage } from '../../lib/welcome.js';

/**
 * `,leave [#channel|text <script>|test|off]` — the card for people who go.
 */

export const name = 'leave';
export const names = ['goodbye'];

export async function prefix(message, args) {
  if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
    await message.reply(no('this needs **manage server**.'));
    return;
  }

  await manage(message, args, 'leave');
}
