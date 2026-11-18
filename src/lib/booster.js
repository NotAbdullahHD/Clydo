import { cached, set } from './config.js';
import { parse } from './paint.js';

/**
 * booster roles.
 *
 * one personal role per booster, hoisted, sitting right under the bot. the
 * server keeps a map of who owns what, so the role can be edited without the
 * member having to remember its id, and a role nobody can prove they own cannot
 * be touched.
 */

const key = 'booster';

export const settings = (guildId) => cached(guildId, key) ?? { roles: {} };

const save = (guildId, roles) => set(guildId, key, { roles });

export const owned = (guildId, userId) => settings(guildId).roles[userId] ?? null;

/** boosters only, and the bot has to be able to move roles at all. */
export function blocker(guild, member) {
  const me = guild.members.me;

  if (!member?.premiumSince) return 'booster roles are for people currently boosting the server.';
  if (!me) return 'i cannot read my own member record.';
  if (!me.permissions.has('ManageRoles')) return 'i need **manage roles** before i can make one.';

  return null;
}

export async function create(guild, member, { name, color = null } = {}) {
  const existing = owned(guild.id, member.id);
  if (existing && guild.roles.cache.has(existing)) return { role: guild.roles.cache.get(existing), created: false };

  const me = guild.members.me;
  const hex = parse(color);

  const role = await guild.roles.create({
    name: (name || `${member.displayName}’s role`).slice(0, 90),
    color: hex ? Number.parseInt(hex.slice(1), 16) : null,
    hoist: true,
    mentionable: false,
    reason: 'booster role',
  }).catch(() => null);

  if (!role) return { error: 'discord refused the role — check my permissions.' };

  await guild.roles.setPosition(role, Math.max(1, me.roles.highest.position - 1)).catch(() => {});
  await member.roles.add(role, 'booster role').catch(() => {});

  save(guild.id, { ...settings(guild.id).roles, [member.id]: role.id });

  return { role, created: true };
}

export async function edit(guild, member, patch) {
  const id = owned(guild.id, member.id);
  const role = id ? guild.roles.cache.get(id) : null;

  if (!role) return { error: 'you do not have a booster role yet — `,boosterrole create`.' };

  if ('name' in patch && patch.name) await role.setName(patch.name.slice(0, 90)).catch(() => {});
  if ('color' in patch) {
    const hex = patch.color ? parse(patch.color) : null;
    await role.setColor(hex ? Number.parseInt(hex.slice(1), 16) : null).catch(() => {});
  }
  if ('icon' in patch) {
    if (guild.premiumTier < 2) return { error: 'role icons need boost level 2.' };
    if (!guild.features.has('ROLE_ICONS')) return { error: 'this server cannot use role icons.' };

    const done = await role.setIcon(patch.icon || null, 'booster role icon')
      .then(() => true)
      .catch(() => false);

    if (!done) return { error: 'discord refused that icon — a png or jpeg under 256kb works.' };
  }

  return { role };
}

export async function remove(guild, member) {
  const id = owned(guild.id, member.id);
  if (!id) return null;

  const roles = { ...settings(guild.id).roles };
  delete roles[member.id];
  save(guild.id, roles);

  await guild.roles.cache.get(id)?.delete('booster role removed').catch(() => {});

  return id;
}
