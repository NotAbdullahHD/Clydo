import { Events } from 'discord.js';
import { cached } from './config.js';

/**
 * autoroles and reaction roles.
 *
 * autoroles are assigned on join, five at most — a role that is worth having is
 * worth not handing out by accident. reaction roles are one binding per message,
 * emoji and role, and both adding and removing the reaction move the role, so the
 * message stays the single source of truth.
 */

const key = 'roles';

export const blank = () => ({ auto: [], reactions: [] });

export const limit = { auto: 5, reactions: 25 };

export function settings(guildId) {
  return { ...blank(), ...(cached(guildId, key) ?? {}) };
}

/** the same identity for unicode and custom emoji. */
export const emojiKey = (emoji) => emoji?.id ?? emoji?.name ?? null;

export function watch(client) {
  client.on(Events.GuildMemberAdd, async (member) => {
    const state = settings(member.guild.id);
    if (!state.auto.length) return;

    for (const roleId of state.auto) {
      await member.roles.add(roleId, 'autorole').catch(() => {});
    }
  });

  const move = async (reaction, user, adding) => {
    if (reaction.partial) await reaction.fetch().catch(() => null);

    const message = reaction.message;
    if (!message?.guildId || !user || user.bot) return;

    const state = settings(message.guildId);
    if (!state.reactions.length) return;

    const found = state.reactions.find(
      (entry) => entry.messageId === message.id && entry.emoji === emojiKey(reaction.emoji),
    );
    if (!found) return;

    const member = await message.guild.members.fetch(user.id).catch(() => null);
    if (!member) return;

    if (adding) await member.roles.add(found.roleId, 'reaction role').catch(() => {});
    else await member.roles.remove(found.roleId, 'reaction role').catch(() => {});
  };

  client.on(Events.MessageReactionAdd, (reaction, user) => {
    move(reaction, user, true).catch(() => {});
  });

  client.on(Events.MessageReactionRemove, (reaction, user) => {
    move(reaction, user, false).catch(() => {});
  });
}
