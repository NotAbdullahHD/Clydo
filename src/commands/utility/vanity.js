import { PermissionFlagsBits } from 'discord.js';
import { presenceOn, save, settings } from '../../lib/vanity.js';
import { no, ok } from '../../lib/line.js';

/**
 * `,vanity set <text> @role [#channel]` — a role while the status holds it.
 */

export const name = 'vanity';

export async function prefix(message, args) {
  if (!presenceOn(message.client)) {
    await message.reply(no('the presence intent is off, so statuses cannot be read.'));
    return;
  }

  if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
    await message.reply(no('this needs **manage server**.'));
    return;
  }

  const head = (args[0] ?? '').toLowerCase();

  if (head === 'off') {
    save(message.guildId, { needle: null, roleId: null, channelId: null });
    await message.reply(ok(message, 'vanity tracking is off.'));
    return;
  }

  if (head === 'set') {
    const role = message.mentions.roles.first();
    const channel = message.mentions.channels.first() ?? null;
    const needle = args.slice(1)
      .filter((part) => !part.startsWith('<@'))
      .join(' ')
      .trim();

    if (!needle || !role) {
      await message.reply(no('usage: `,vanity set /clydo @role [#channel]`'));
      return;
    }

    save(message.guildId, { needle, roleId: role.id, channelId: channel?.id ?? null });
    await message.reply(ok(message, `holding **${needle}** in a status earns <@&${role.id}>.`));
    return;
  }

  const state = settings(message.guildId);

  await message.reply({
    embeds: [{
      color: 0x2b2d31,
      title: 'vanity',
      description: [
        `\`›\` watching  •  ${state.needle ?? 'not set'}`,
        `\`›\` role  •  ${state.roleId ? `<@&${state.roleId}>` : 'none'}`,
        `\`›\` thanks  •  ${state.channelId ? `<#${state.channelId}>` : 'off'}`,
      ].join('\n'),
      footer: { text: '`,vanity set /clydo @role`  ·  `,vanity off`' },
    }],
  });
}
