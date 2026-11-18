import { Events } from 'discord.js';
import { cached, set } from './config.js';
import { sql } from './sqlite.js';

/**
 * jail.
 *
 * a timeout silences somebody; a jail takes their roles and puts them in one
 * room, then hands every role back on release. the stripped roles are stored,
 * so the release survives a restart, and a member who leaves and rejoins is put
 * straight back in.
 */

const key = 'jail';

export const settings = (guildId) => cached(guildId, key) ?? { roleId: null, channelId: null };

export function save(guildId, patch) {
  const next = { ...settings(guildId), ...patch };
  set(guildId, key, next);

  return next;
}

export function held(guildId, userId) {
  const row = sql().prepare('SELECT roles FROM jail WHERE guild_id = ? AND user_id = ?').get(guildId, userId);

  if (!row) return null;

  return { roles: JSON.parse(row.roles) };
}

function remember(guildId, userId, roles) {
  sql()
    .prepare(`
      INSERT INTO jail (guild_id, user_id, roles, at) VALUES (?, ?, ?, ?)
      ON CONFLICT (guild_id, user_id) DO UPDATE SET roles = excluded.roles, at = excluded.at
    `)
    .run(guildId, userId, JSON.stringify(roles), Date.now());
}

const forget = (guildId, userId) => sql()
  .prepare('DELETE FROM jail WHERE guild_id = ? AND user_id = ?')
  .run(guildId, userId);

/** why the cage cannot be built, or null when it can. */
export function blocker(guild, roleId) {
  const me = guild.members.me;
  const role = guild.roles.cache.get(roleId);

  if (!role) return 'the jail role is gone — set it again with `,jail setup`.';
  if (!me) return 'i cannot read my own member record.';
  if (role.position >= me.roles.highest.position) return 'the jail role sits above my highest role.';

  return null;
}

/** strip everything the bot is allowed to strip, and remember it. */
export async function cage(member, reason = 'jailed') {
  const { roleId } = settings(member.guild.id);
  const problem = blocker(member.guild, roleId);
  if (problem) return { error: problem };

  const me = member.guild.members.me;
  const keep = [];

  for (const [id, role] of member.roles.cache) {
    if (id === member.guild.id) continue;
    if (role.managed) continue;
    if (role.position >= me.roles.highest.position) {
      keep.push(id);
      continue;
    }

    await member.roles.remove(id, reason).catch(() => keep.push(id));
  }

  remember(member.guild.id, member.id, keep);
  await member.roles.add(roleId, reason).catch(() => {});

  return { kept: keep.length };
}

/** hand back what was taken, minus anything deleted in between. */
export async function free(member, reason = 'released') {
  const state = held(member.guild.id, member.id);
  const { roleId } = settings(member.guild.id);

  const back = (state?.roles ?? []).filter((id) => member.guild.roles.cache.has(id));

  if (roleId) await member.roles.remove(roleId, reason).catch(() => {});
  if (back.length) await member.roles.add(back, reason).catch(() => {});

  forget(member.guild.id, member.id);

  return back.length;
}

/** a jailed member who left and rejoined goes back in without being asked. */
export function watch(client) {
  client.on(Events.GuildMemberAdd, async (member) => {
    if (!held(member.guild.id, member.id)) return;

    const { roleId } = settings(member.guild.id);
    if (roleId) await member.roles.add(roleId, 'still jailed').catch(() => {});
  });
}
