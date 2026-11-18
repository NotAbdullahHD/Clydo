import { PermissionFlagsBits } from 'discord.js';
import { no } from '../../lib/line.js';
import { manage } from '../../lib/welcome.js';

/**
 * `,boost [#channel|text <script>|test|off]` — the card for new boosters.
 */

export const name = 'boost';
export const names = ['boostmessage'];

export async function prefix(message, args) {
  if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
    await message.reply(no('this needs **manage server**.'));
    return;
  }

  await manage(message, args, 'boost');
}
