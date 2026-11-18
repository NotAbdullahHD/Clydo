import { Events, GatewayIntentBits } from 'discord.js';
import { cached, set } from './config.js';
import { emoji } from './emoji.js';

/**
 * vanity.
 *
 * the role follows the status, not the other way round: put the server's vanity
 * in your custom status and the role arrives, take it out and the role leaves.
 * reading a custom status needs the presence intent, so with that off this
 * feature is dormant and the command says so instead of pretending.
 */

const key = 'vanity';

/** `,vanity set /clydo @role #channel` */
export const settings = (guildId) => cached(guildId, key) ?? { needle: null, roleId: null, channelId: null };

export function save(guildId, patch) {
  const next = { ...settings(guildId), ...patch };
  set(guildId, key, next);

  return next;
}

const holding = new Map();

const custom = (presence) => presence?.activities?.find((activity) => activity.type === 4)?.state ?? '';

export function watch(client) {
  client.on(Events.PresenceUpdate, async (_before, after) => {
    const member = after.member;
    const guild = after.guild;
    if (!member || !guild) return;

    const config = settings(guild.id);
    if (!config.needle || !config.roleId) return;

    const text = custom(after).toLowerCase();
    const holds = text.includes(config.needle.toLowerCase());
    const has = member.roles.cache.has(config.roleId);
    const key = `${guild.id}:${member.id}`;

    if (holds && !has) {
      const role = guild.roles.cache.get(config.roleId);
      if (!role) return;

      const added = await member.roles.add(role, 'vanity in status').catch(() => null);
      if (!added) return;

      holding.set(key, true);

      if (config.channelId) {
        await guild.channels.cache.get(config.channelId)
          ?.send({ content: `${emoji.check} <@${member.id}>: vanity in status — thank you.`, allowedMentions: { users: [member.id] } })
          .catch(() => {});
      }
      return;
    }

    if (!holds && has && holding.get(key)) {
      holding.delete(key);
      await member.roles.remove(config.roleId, 'vanity removed from status').catch(() => {});
    }
  });
}

export const presenceOn = (client) => client?.options?.intents?.has?.(GatewayIntentBits.GuildPresences) ?? false;
