import { Events, PermissionFlagsBits } from 'discord.js';
import { cached } from './config.js';
import { oops } from './line.js';

/**
 * autoroles and reaction roles.
 *
 * autoroles are assigned on join, five at most. reaction roles are one binding
 * per message, emoji and role, and both adding and removing the reaction move
 * the role, so the message stays the single source of truth.
 *
 * every failure that used to be swallowed is spoken now: a role above the bot's
 * highest role looks exactly like the feature being broken, and silence is how
 * it stayed broken.
 */

const key = 'roles';

export const blank = () => ({ auto: [], reactions: [] });

export const limit = { auto: 5, reactions: 25 };

export function settings(guildId) {
  return { ...blank(), ...(cached(guildId, key) ?? {}) };
}

/** `⭐` and `⭐️` are the same emoji; discord sends both. */
export const norm = (value) => String(value ?? '').replace(/\uFE0F/g, '');

/** the same identity for unicode and custom emoji. */
export function emojiKey(emoji) {
  if (emoji?.id) return String(emoji.id);
  return norm(emoji?.name ?? '') || null;
}

/** why the bot cannot hand this role out, or null when it can. */
export async function blocker(guild, roleId) {
  const me = guild.members.me ?? await guild.members.fetchMe().catch(() => null);
  if (!me) return 'i cannot read my own member record.';

  const role = guild.roles.cache.get(roleId) ?? await guild.roles.fetch(roleId).catch(() => null);
  if (!role) return 'that role no longer exists.';
  if (!me.permissions.has(PermissionFlagsBits.ManageRoles)) {
    return 'i need **manage roles** before i can give that out.';
  }
  if (role.managed) return 'that role belongs to an integration, not to me.';
  if (role.position >= me.roles.highest.position) {
    return 'that role sits above my highest role — move mine up.';
  }

  return null;
}

/** one warning per problem per ten minutes, so a broken role cannot spam. */
const warned = new Map();

async function tell(channel, message) {
  const until = warned.get(message);
  if (until && until > Date.now()) return;

  warned.set(message, Date.now() + 600_000);
  if (warned.size > 200) warned.delete(warned.keys().next().value);

  await channel?.send?.({ ...oops(message), allowedMentions: { parse: [] } }).catch(() => {});
}

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

    const emoji = emojiKey(reaction.emoji);
    const found = state.reactions.find(
      (entry) => entry.messageId === message.id && norm(entry.emoji) === norm(emoji),
    );
    if (!found) return;

    const guild = message.guild
      ?? await message.client.guilds.fetch(message.guildId).catch(() => null);
    if (!guild) return;

    const member = await guild.members.fetch(user.id).catch(() => null);
    if (!member) return;

    const problem = await blocker(guild, found.roleId);
    if (problem) {
      await tell(message.channel, problem);
      return;
    }

    const role = guild.roles.cache.get(found.roleId) ?? found.roleId;

    if (adding) {
      if (member.roles.cache.has(found.roleId)) return;

      const result = await member.roles.add(role, 'reaction role').catch((error) => error);
      if (result instanceof Error) {
        await tell(message.channel, `could not give <@&${found.roleId}> — ${result.message}`);
      }
      return;
    }

    if (!member.roles.cache.has(found.roleId)) return;

    const result = await member.roles.remove(role, 'reaction role').catch((error) => error);
    if (result instanceof Error) {
      await tell(message.channel, `could not take <@&${found.roleId}> back — ${result.message}`);
    }
  };

  client.on(Events.MessageReactionAdd, (reaction, user) => {
    move(reaction, user, true).catch(() => {});
  });

  client.on(Events.MessageReactionRemove, (reaction, user) => {
    move(reaction, user, false).catch(() => {});
  });
}
