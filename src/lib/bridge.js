import { Collection } from 'discord.js';

/**
 * a prefix command's message, backed by an interaction.
 *
 * the management commands are written once as prefix handlers and reached from
 * a slash command by handing them this shape, so `/ticket setup` and `,ticket
 * setup` cannot drift apart into two behaviours.
 */

export function shape(interaction, args, { channel = null, role = null, member = null } = {}) {
  return {
    guild: interaction.guild,
    guildId: interaction.guildId,
    client: interaction.client,
    author: interaction.user,
    member: interaction.member,
    channel: interaction.channel,
    mentions: {
      channels: new Collection(channel ? [[channel.id, channel]] : []),
      roles: new Collection(role ? [[role.id, role]] : []),
      members: new Collection(member ? [[member.id, member]] : []),
    },
    content: args.join(' '),
    reply: (payload) => interaction.reply(payload),
  };
}
