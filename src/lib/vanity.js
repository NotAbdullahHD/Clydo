import { Events, GatewayIntentBits, PermissionFlagsBits } from 'discord.js';
import { cached, set } from './config.js';
import { emoji } from './emoji.js';

/**
 * vanity.
 *
 * the role follows the status, not the other way round: put the server's vanity
 * in your custom status and the role arrives, take it out and the role leaves.
 *
 * presence updates only fire when a status *changes*, so a member who already
 * had the vanity before setup would never be seen — setup sweeps the guild, and
 * a slow sweep keeps watching for people whose presence was not delivered.
 */

const key = 'vanity';
const sweepEvery = 10 * 60 * 1000;

export const settings = (guildId) => cached(guildId, key) ?? { needle: null, roleId: null, channelId: null };

export function save(guildId, patch) {
  const next = { ...settings(guildId), ...patch };
  set(guildId, key, next);

  return next;
}

/** why the role cannot be handed out, or null when it can. */
export function blocker(guild, roleId) {
  const me = guild.members.me;
  const role = guild.roles.cache.get(roleId);

  if (!role) return 'that role is gone — run `,vanity set` again.';
  if (!me) return 'i cannot read my own member record.';
  if (!me.permissions.has(PermissionFlagsBits.ManageRoles)) return 'i need **manage roles** to hand it out.';
  if (role.managed) return 'that role belongs to an integration.';
  if (role.position >= me.roles.highest.position) return 'that role sits above my highest — move mine up.';

  return null;
}

const custom = (presence) => presence?.activities?.find((activity) => activity.type === 4)?.state ?? '';

/** what we handed out, so a role somebody already had is never taken away. */
const granted = new Set();
const mark = (guildId, userId) => {
  if (granted.size > 5_000) granted.delete(granted.values().next().value);
  granted.add(`${guildId}:${userId}`);
};

/** add the role, or say exactly why discord refused. */
export async function award(member, config = settings(member.guild.id)) {
  const problem = blocker(member.guild, config.roleId);
  if (problem) return { problem };

  if (member.roles.cache.has(config.roleId)) return { state: 'present' };

  const done = await member.roles.add(config.roleId, 'vanity in status')
    .then(() => null)
    .catch((error) => error.message);

  if (done) return { problem: `discord refused the role — ${done}` };

  mark(member.guild.id, member.id);

  return { state: 'added' };
}

export async function withdraw(member, config = settings(member.guild.id)) {
  if (!config.roleId) return { state: 'off' };
  if (!granted.has(`${member.guild.id}:${member.id}`)) return { state: 'untouched' };

  granted.delete(`${member.guild.id}:${member.id}`);
  await member.roles.remove(config.roleId, 'vanity removed from status').catch(() => {});

  return { state: 'removed' };
}

/** everyone whose status holds the vanity right now. */
export async function sweep(guild, config = settings(guild.id), log = () => {}) {
  if (!config.needle || !config.roleId) return { added: 0, problem: null };

  const problem = blocker(guild, config.roleId);
  if (problem) {
    log(`vanity — ${problem}`);
    return { added: 0, problem };
  }

  let added = 0;

  for (const member of guild.members.cache.values()) {
    if (member.user.bot) continue;
    if (!custom(member.presence).toLowerCase().includes(config.needle.toLowerCase())) continue;

    const result = await award(member, config);
    if (result.problem) log(`vanity — ${member.user.username}: ${result.problem}`);
    if (result.state === 'added') {
      added += 1;

      if (config.channelId) {
        await guild.channels.cache.get(config.channelId)
          ?.send({ content: `${emoji.check} <@${member.id}>: vanity in status — thank you.`, allowedMentions: { users: [member.id] } })
          .catch(() => {});
      }
    }
  }

  return { added, problem: null };
}

export function watch(client, log = () => {}) {
  client.on(Events.PresenceUpdate, async (_before, after) => {
    const guild = after.guild;
    if (!guild) return;

    const config = settings(guild.id);
    if (!config.needle || !config.roleId) return;

    const member = after.member ?? guild.members.cache.get(after.userId);
    if (!member || member.user.bot) return;

    const holds = custom(after).toLowerCase().includes(config.needle.toLowerCase());

    if (!holds) {
      await withdraw(member, config);
      return;
    }

    const result = await award(member, config);

    if (result.problem) {
      log(`vanity — ${member.user.username}: ${result.problem}`);
      return;
    }

    if (result.state !== 'added') return;

    if (config.channelId) {
      await guild.channels.cache.get(config.channelId)
        ?.send({ content: `${emoji.check} <@${member.id}>: vanity in status — thank you.`, allowedMentions: { users: [member.id] } })
        .catch(() => {});
    }
  });

  /** a slow sweep catches members whose presence never produced an update. */
  const timer = setInterval(() => {
    for (const guild of client.guilds.cache.values()) {
      const config = settings(guild.id);
      if (!config.needle) continue;

      sweep(guild, config, log).catch(() => {});
    }
  }, sweepEvery);

  timer.unref?.();
}

export const presenceOn = (client) => client?.options?.intents?.has?.(GatewayIntentBits.GuildPresences) ?? false;
