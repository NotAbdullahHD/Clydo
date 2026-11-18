import { free, held } from '../../lib/jail.js';
import { allows, refusal } from '../../lib/perms.js';
import { no, ok } from '../../lib/line.js';

/**
 * `,unjail @user` — hand every stored role back.
 */

export const name = 'unjail';
export const names = ['release'];

export async function prefix(message, args) {
  if (!allows(message.member, 'jail')) {
    await message.reply(no(refusal('jail')));
    return;
  }

  const target = message.mentions.members.first();

  if (!target) {
    await message.reply(no('usage: `,unjail @user`'));
    return;
  }

  if (!held(message.guildId, target.id)) {
    await message.reply(no(`${target.user.username} is not jailed.`));
    return;
  }

  const result = await free(target);

  if (result.error) {
    await message.reply(no(result.error));
    return;
  }

  await message.reply(ok(message, `released **${target.user.username}** — ${result.restored} role${result.restored === 1 ? '' : 's'} back.`));
}
