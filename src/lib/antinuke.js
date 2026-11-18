import { AuditLogEvent, Events, PermissionFlagsBits } from 'discord.js';
import { cached, set } from './config.js';
import { emoji } from './emoji.js';

/**
 * antinuke, kept deliberately small.
 *
 * the audit log says who did a thing; this counts how many of one kind of thing
 * one person did in ten seconds and stops them at the threshold. a real
 * antinuke inspects every permission change; this catches the obvious bans,
 * channel deletions and role deletions, and it is off until a server turns it on.
 */

const key = 'antinuke';

export const defaults = Object.freeze({ on: false, threshold: 3, window: 10_000, punish: 'strip', logChannelId: null, trusted: [] });

export const settings = (guildId) => ({ ...defaults, ...(cached(guildId, key) ?? {}) });

export function save(guildId, patch) {
  const next = { ...settings(guildId), ...patch };
  set(guildId, key, next);

  return next;
}

const watched = new Map([
  [AuditLogEvent.MemberBanAdd, 'ban'],
  [AuditLogEvent.MemberKick, 'kick'],
  [AuditLogEvent.ChannelDelete, 'channel delete'],
  [AuditLogEvent.RoleDelete, 'role delete'],
  [AuditLogEvent.MemberRoleUpdate, 'role change'],
]);

/** executorId:action → timestamps. */
const hits = new Map();

export function watch(client) {
  client.on(Events.GuildAuditLogEntryCreate, async (entry, guild) => {
    const config = settings(guild.id);
    if (!config.on) return;

    const action = watched.get(entry.action);
    if (!action) return;

    const executorId = entry.executorId;
    if (!executorId) return;
    if (executorId === client.user.id) return;
    if (executorId === guild.ownerId) return;
    if (config.trusted.includes(executorId)) return;

    const stamp = `${guild.id}:${executorId}:${action}`;
    const now = Date.now();
    const recent = (hits.get(stamp) ?? []).filter((time) => now - time < config.window);
    recent.push(now);
    hits.set(stamp, recent);

    /* one map for every guild, forever, would be a leak: drop what aged out. */
    if (hits.size > 500) {
      for (const [id, times] of hits) {
        if (!times.some((time) => now - time < config.window)) hits.delete(id);
      }
    }

    if (recent.length < config.threshold) return;

    hits.delete(stamp);

    const member = await guild.members.fetch(executorId).catch(() => null);
    if (!member) return;

    let done = 'nothing';

    if (config.punish === 'ban' && !guild.members.me.permissions.has(PermissionFlagsBits.BanMembers)) {
      done = 'could not ban — i have no permission to ban';
    } else if (config.punish === 'ban') {
      const banned = await member.ban({ reason: `antinuke — ${recent.length}× ${action}` })
        .then(() => true)
        .catch(() => false);
      if (banned) done = 'banned';
    } else if (config.punish === 'kick') {
      const kicked = await member.kick(`antinuke — ${recent.length}× ${action}`)
        .then(() => true)
        .catch(() => false);
      if (kicked) done = 'kicked';
    } else {
      const above = member.roles.highest.position >= guild.members.me.roles.highest.position;
      if (!above) {
        const stripped = await member.roles.set([], `antinuke — ${recent.length}× ${action}`)
          .then(() => true)
          .catch(() => false);
        if (stripped) done = 'stripped of every role';
      }
    }

    const line = `${emoji.warning} <@${executorId}>: ${recent.length}× ${action} in ${Math.round(config.window / 1000)}s — ${done}.`;

    await guild.channels.cache.get(config.logChannelId)
      ?.send({ content: line, allowedMentions: { parse: [] } })
      .catch(() => {});
  });
}
