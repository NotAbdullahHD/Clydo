import { ChannelType, PermissionFlagsBits } from 'discord.js';
import { save, settings } from '../../lib/voicemaster.js';
import { no, ok } from '../../lib/line.js';

/**
 * `,voicemaster [setup #hub|off|status]` — the join-to-create hub.
 */

export const name = 'voicemaster';
export const names = ['vm'];

export async function prefix(message, args) {
  const head = (args[0] ?? 'status').toLowerCase();

  if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
    await message.reply(no('this needs **manage channels**.'));
    return;
  }

  if (head === 'setup' || head === 'on') {
    const channel = message.mentions.channels.first()
      ?? message.guild.channels.cache.get(args[1])
      ?? null;

    if (!channel || channel.type !== ChannelType.GuildVoice) {
      await message.reply(no('mention the voice channel people should join.'));
      return;
    }

    save(message.guildId, { hubId: channel.id, categoryId: channel.parentId ?? null });

    await message.reply(ok(message, `<#${channel.id}> is the hub — join it and a room appears.`));
    return;
  }

  if (head === 'off') {
    save(message.guildId, { hubId: null });
    await message.reply(ok(message, 'join-to-create is off.'));
    return;
  }

  const state = settings(message.guildId);

  await message.reply({
    embeds: [{
      color: 0x2b2d31,
      title: 'voicemaster',
      description: [
        '`›` hub  •  ' + (state.hubId ? `<#${state.hubId}>` : 'not set'),
        '`›` setup  •  `,voicemaster setup #hub`',
      ].join('\n'),
    }],
  });
}
