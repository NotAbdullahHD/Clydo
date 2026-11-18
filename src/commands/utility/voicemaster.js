import { PermissionFlagsBits } from 'discord.js';
import { dismantle, provision, settings } from '../../lib/voicemaster.js';
import { no, ok } from '../../lib/line.js';
import { panel, palette } from '../../lib/theme.js';

/**
 * `,voicemaster [setup|off]` — builds the vc category, text channel and hub.
 */

export const name = 'voicemaster';
export const names = ['vm'];

export async function prefix(message, args) {
  const head = (args[0] ?? '').toLowerCase();

  if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
    await message.reply(no('this needs **manage channels**.'));
    return;
  }

  if (head === 'setup' || head === 'on') {
    const state = settings(message.guildId);

    if (state.hubId && message.guild.channels.cache.has(state.hubId)) {
      await message.reply(ok(message, `<#${state.hubId}> is already the hub.`));
      return;
    }

    const result = await provision(message.guild, args[1] || 'vc');

    if (result.problem) {
      await message.reply(no(result.problem));
      return;
    }

    await message.reply(ok(message, 'built **vc** — category, text channel and <#'.concat(result.hub.id, '>. join it to get a room.')));
    return;
  }

  if (head === 'off' || head === 'reset') {
    const gone = await dismantle(message.guild);

    await message.reply(gone ? ok(message, `removed ${gone} channel${gone === 1 ? '' : 's'}.`) : no('there is nothing set up.'));
    return;
  }

  const state = settings(message.guildId);

  await message.reply({
    embeds: [panel({
      title: 'voicemaster',
      accent: palette.panel,
      description: [
        `\`›\` hub  •  ${state.hubId ? `<#${state.hubId}>` : 'not set'}`,
        `\`›\` text  •  ${state.textId ? `<#${state.textId}>` : 'none'}`,
        `\`›\` category  •  ${state.categoryId ? `<#${state.categoryId}>` : 'none'}`,
      ].join('\n'),
      footer: '`,voicemaster setup` builds everything  ·  `,voicemaster off` removes it',
    })],
    allowedMentions: { parse: [] },
  });
}
