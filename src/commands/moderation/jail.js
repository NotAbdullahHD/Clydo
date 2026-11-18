import { PermissionFlagsBits } from 'discord.js';
import { cage, held, save, settings } from '../../lib/jail.js';
import { allows, refusal } from '../../lib/perms.js';
import { no, ok } from '../../lib/line.js';
import { panel } from '../../lib/theme.js';

/**
 * `,jail @user [reason]` — strip roles, one room, every role stored for release.
 */

export const name = 'jail';
export const names = ['imprison'];

export async function prefix(message, args) {
  const head = (args[0] ?? '').toLowerCase();

  if (head === 'setup') {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
      await message.reply(no('setting the jail role needs **manage roles**.'));
      return;
    }

    const role = message.mentions.roles.first();
    const channel = message.mentions.channels.first() ?? null;

    if (!role) {
      await message.reply(no('usage: `,jail setup @role [#channel]`'));
      return;
    }

    save(message.guildId, { roleId: role.id, channelId: channel?.id ?? null });
    await message.reply(ok(message, `jailing into <@&${role.id}>.`));
    return;
  }

  if (!allows(message.member, 'jail')) {
    await message.reply(no(refusal('jail')));
    return;
  }

  const target = message.mentions.members.first();

  if (!target) {
    const state = settings(message.guildId);

    await message.reply({
      embeds: [panel({
        title: 'jail',
        description: [
          `\`›\` role  •  ${state.roleId ? `<@&${state.roleId}>` : 'not set — `,jail setup @role`'}`,
          `\`›\` release  •  \`,unjail @user\``,
        ].join('\n'),
        footer: 'every role is stored and handed back',
      })],
    });
    return;
  }

  if (held(message.guildId, target.id)) {
    await message.reply(no(`${target.user.username} is already jailed.`));
    return;
  }

  if (!target.manageable) {
    await message.reply(no('i cannot change that member — check role hierarchy.'));
    return;
  }

  const reason = args.slice(1).join(' ') || 'no reason given';
  const result = await cage(target, reason);

  if (result.error) {
    await message.reply(no(result.error));
    return;
  }

  await message.reply(ok(message, `jailed **${target.user.username}** — ${reason}.`));

  const channelId = settings(message.guildId).channelId;
  if (channelId) {
    await message.guild.channels.cache.get(channelId)
      ?.send({ content: `<@${target.id}> you are in jail — ${reason}. <@${message.author.id}> can release you.`, allowedMentions: { users: [target.id] } })
      .catch(() => {});
  }
}
