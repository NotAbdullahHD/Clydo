import { PermissionFlagsBits } from 'discord.js';
import { cached, set } from './config.js';

/**
 * fake permissions.
 *
 * a server owner can hand a role the right to use one of slink's moderation
 * commands without giving that role the real discord permission. it is a gate
 * in front of our own handlers and nothing else — discord never sees it, so a
 * role granted `ban` here still cannot touch the audit log.
 */

export const abilities = Object.freeze({
  ban: { bit: PermissionFlagsBits.BanMembers, label: 'ban members' },
  unban: { bit: PermissionFlagsBits.BanMembers, label: 'ban members' },
  kick: { bit: PermissionFlagsBits.KickMembers, label: 'kick members' },
  timeout: { bit: PermissionFlagsBits.ModerateMembers, label: 'timeout members' },
  clear: { bit: PermissionFlagsBits.ManageMessages, label: 'manage messages' },
  purge: { bit: PermissionFlagsBits.ManageMessages, label: 'manage messages' },
  role: { bit: PermissionFlagsBits.ManageRoles, label: 'manage roles' },
  slowmode: { bit: PermissionFlagsBits.ManageChannels, label: 'manage channels' },
  nick: { bit: PermissionFlagsBits.ManageNicknames, label: 'manage nicknames' },
  warn: { bit: PermissionFlagsBits.ManageMessages, label: 'manage messages' },
  jail: { bit: PermissionFlagsBits.ModerateMembers, label: 'timeout members' },
  antinuke: { bit: PermissionFlagsBits.Administrator, label: 'administrator' },
  fakeperms: { bit: PermissionFlagsBits.Administrator, label: 'administrator' },
  voicemaster: { bit: PermissionFlagsBits.ManageChannels, label: 'manage channels' },
  autoresponder: { bit: PermissionFlagsBits.ManageMessages, label: 'manage messages' },
  alias: { bit: PermissionFlagsBits.ManageGuild, label: 'manage server' },
  vanity: { bit: PermissionFlagsBits.ManageGuild, label: 'manage server' },
});

const key = 'fakeperms';

/** roleId → ability names. */
export const table = (guildId) => cached(guildId, key) ?? {};

const save = (guildId, next) => set(guildId, key, next);

export function grant(guildId, roleId, ability, all = false) {
  const next = { ...table(guildId) };
  const current = new Set(next[roleId] ?? []);

  if (all) Object.keys(abilities).forEach((name) => current.add(name));
  else current.add(ability);

  next[roleId] = [...current];
  save(guildId, next);

  return next[roleId];
}

export function revoke(guildId, roleId, ability = null) {
  const next = { ...table(guildId) };

  if (!ability) delete next[roleId];
  else next[roleId] = (next[roleId] ?? []).filter((name) => name !== ability);

  if (next[roleId] && !next[roleId].length) delete next[roleId];

  save(guildId, next);

  return next[roleId] ?? [];
}

/** does this member hold the ability, by discord permission or by grant? */
export function allows(member, ability) {
  if (!member) return false;

  const entry = abilities[ability];
  if (entry?.bit && member.permissions?.has?.(entry.bit)) return true;

  const guildId = member.guild?.id ?? member.guildId;
  if (!guildId) return false;

  const map = table(guildId);

  return [...(member.roles?.cache?.keys?.() ?? [])]
    .some((roleId) => (map[roleId] ?? []).includes(ability));
}

/** what to tell somebody who does not have it. */
export const refusal = (ability) => `you need **${abilities[ability]?.label ?? ability}** for that.`;

/** the ability list as one wrapped line, for the help card. */
export const catalogue = () => Object.keys(abilities).join('  ');
