import { PermissionFlagsBits } from 'discord.js';
import { award, blocker, presenceOn, save, settings, sweep } from '../../lib/vanity.js';
import { no, ok } from '../../lib/line.js';
import { panel, palette } from '../../lib/theme.js';

/**
 * `,vanity set <text> @role [#channel]` — a role while the status holds it.
 */

export const name = 'vanity';

export async function prefix(message, args) {
  if (!presenceOn(message.client)) {
    await message.reply(no('the presence intent is off, so custom statuses cannot be read — enable it in the portal and restart.'));
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

  if (head === 'check') {
    const target = message.mentions.members.first() ?? message.member;
    const config = settings(message.guildId);

    if (!config.roleId) {
      await message.reply(no('nothing is set up — `,vanity set /clydo @role`.'));
      return;
    }

    const result = await award(target, config);

    if (result.problem) await message.reply(no(result.problem));
    else if (result.state === 'added') await message.reply(ok(message, `gave <@&${config.roleId}> to **${target.user.username}**.`));
    else await message.reply(ok(message, `**${target.user.username}** already has it — or their status does not hold it.`));
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

    const problem = blocker(message.guild, role.id);
    if (problem) {
      await message.reply(no(problem));
      return;
    }

    save(message.guildId, { needle, roleId: role.id, channelId: channel?.id ?? null });

    // grant to everyone already holding it, so setup does not need a status change.
    const result = await sweep(message.guild, settings(message.guildId), (line) => console.warn('[slink]', line));

    await message.reply(ok(message, `watching **${needle}** — ${result.added} member${result.added === 1 ? '' : 's'} got <@&${role.id}> now.`));
    return;
  }

  const state = settings(message.guildId);

  await message.reply({
    embeds: [panel({
      title: 'vanity',
      description: [
        `\`›\` watching  •  ${state.needle ?? 'not set'}`,
        `\`›\` role  •  ${state.roleId ? `<@&${state.roleId}>` : 'none'}`,
        `\`›\` thanks  •  ${state.channelId ? `<#${state.channelId}>` : 'off'}`,
      ].join('\n'),
      footer: '`,vanity set /clydo @role`  ·  `,vanity check @user`  ·  `,vanity off`',
      accent: palette.panel,
    })],
    allowedMentions: { parse: [] },
  });
}
