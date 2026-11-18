import { allows, refusal } from '../../lib/perms.js';
import { no, ok } from '../../lib/line.js';

/**
 * `,role @user <role>` — adds when missing, removes when present.
 */

export const name = 'role';
export const names = ['r'];

export async function prefix(message, args) {
  if (!allows(message.member, 'role')) {
    await message.reply(no(refusal('role')));
    return;
  }

  const target = message.mentions.members.first();
  if (!target) {
    await message.reply(no('usage: `,role @user <role>`'));
    return;
  }

  const query = args.slice(1).join(' ').replace(/<@&\d+>/g, '').trim();
  const role = message.mentions.roles.first()
    ?? message.guild.roles.cache.find((candidate) => candidate.name.toLowerCase().includes(query.toLowerCase()));

  if (!role) {
    await message.reply(no(query ? `no role called \`${query}\`.` : 'name the role too.'));
    return;
  }

  if (role.managed) {
    await message.reply(no('that role belongs to an integration.'));
    return;
  }

  if (role.position >= message.guild.members.me.roles.highest.position) {
    await message.reply(no('that role sits above my highest — move mine up.'));
    return;
  }

  if (target.roles.cache.has(role.id)) {
    await target.roles.remove(role);
    await message.reply(ok(message, `**${role.name}** off **${target.user.username}**.`));
    return;
  }

  await target.roles.add(role);
  await message.reply(ok(message, `**${role.name}** on **${target.user.username}**.`));
}
