import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ChannelType, EmbedBuilder, Events, PermissionFlagsBits } from 'discord.js';
import { db } from './db.js';
import { report } from './errors.js';
import { palette } from './theme.js';

/**
 * honeypot — one bait channel per guild.
 *
 * a spam bot joins, scrapes every channel it can see and posts in all of them.
 * the trap is a channel with a warning and no reason to exist, so the first
 * message in it is proof enough: the author gets the configured punishment and
 * the counter in the notice goes up by one.
 *
 * members who could plausibly be staff are never touched — a false ban on a real
 * person costs more than a missed bot.
 */

const file = path.join(process.cwd(), 'data', 'honeypot.json');

/** punishment → how the notice words it, and which counter it feeds. */
const kinds = Object.freeze({
  ban: { field: 'bans', verb: 'banned' },
  softban: { field: 'softbans', verb: 'banned and unbanned — your recent messages go too' },
  kick: { field: 'kicks', verb: 'kicked' },
  timeout: { field: 'timeouts', verb: 'timed out for ten minutes' },
  delete: { field: 'caught', verb: 'caught, and the message is deleted' },
});

export const punishments = Object.keys(kinds);
export const isPunishment = (value) => Object.hasOwn(kinds, value);
export const timeoutLength = 10 * 60_000;

/** per-punishment counters, so switching punishment doesn't relabel old catches. */
const blank = () => Object.fromEntries(punishments.map((name) => [name, 0]));

const shape = (doc = {}) => ({
  guildId: doc.guildId,
  enabled: Boolean(doc.enabled),
  channelId: doc.channelId ?? null,
  noticeId: doc.noticeId ?? null,
  punishment: isPunishment(doc.punishment) ? doc.punishment : 'ban',
  message: doc.message ?? null,
  counts: { ...blank(), ...(doc.counts ?? {}) },
});

const collection = () => db()?.collection('honeypot');

let cache = null;

async function load() {
  if (cache) return cache;

  let raw = {};

  try {
    raw = JSON.parse(await readFile(file, 'utf8'));
  } catch {
    raw = {};
  }

  cache = { guilds: raw?.guilds ?? {} };
  return cache;
}

async function save() {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(cache, null, 2)}\n`);
}

export async function get(guildId) {
  const table = collection();

  if (table) return shape((await table.findOne({ guildId })) ?? { guildId });

  const data = await load();
  return shape(data.guilds[guildId] ?? { guildId });
}

export async function set(guildId, patch) {
  const next = shape({ ...(await get(guildId)), ...patch, guildId });
  const table = collection();

  if (table) {
    await table.updateOne({ guildId }, { $set: next }, { upsert: true });
    return next;
  }

  const data = await load();
  data.guilds[guildId] = next;

  await save();
  return next;
}

/** count one catch against the punishment that fired. */
export async function bump(guildId, punishment) {
  const record = await get(guildId);
  const counts = { ...record.counts, [punishment]: (record.counts[punishment] ?? 0) + 1 };

  return set(guildId, { counts });
}

/** the warning that sits in the channel. */
export function notice(record) {
  const kind = kinds[record.punishment];

  return new EmbedBuilder()
    .setColor(palette.panel)
    .setTitle('do not send messages in this channel')
    .setDescription(
      record.message
      || `this channel exists to catch spam bots. one message in here and you are ${kind.verb}.`,
    )
    .addFields({ name: kind.field, value: `\`${record.counts[record.punishment] ?? 0}\``, inline: true })
    .setFooter({ text: 'only accounts that ignore the channel warning end up here.' });
}

/** keep the notice's counter honest after a catch or a settings change. */
export async function refresh(guild, record) {
  if (!record.channelId || !record.noticeId) return;

  const channel = guild.channels.cache.get(record.channelId);
  const sent = await channel?.messages.fetch(record.noticeId).catch(() => null);

  await sent?.edit({ embeds: [notice(record)] }).catch(() => {});
}

/** create the channel, post the warning, remember both ids. */
export async function create(guild, record) {
  const channel = await guild.channels.create({
    name: 'honeypot',
    type: ChannelType.GuildText,
    topic: 'do not send messages here — this channel catches spam bots.',
    reason: 'honeypot trap',
    permissionOverwrites: [
      {
        id: guild.roles.everyone.id,
        allow: [PermissionFlagsBits.ViewChannel],
        deny: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.CreatePublicThreads],
      },
      {
        id: guild.members.me.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.EmbedLinks,
          PermissionFlagsBits.ManageMessages,
          PermissionFlagsBits.ReadMessageHistory,
        ],
      },
    ],
  });

  const saved = await set(guild.id, { ...record, enabled: true, channelId: channel.id });
  const sent = await channel.send({ embeds: [notice(saved)] });

  await sent.pin().catch(() => {});

  return set(guild.id, { noticeId: sent.id });
}

/** stop the trap and take the bait channel with it. */
export async function remove(guild, record) {
  const channel = record.channelId ? guild.channels.cache.get(record.channelId) : null;

  await channel?.delete('honeypot disabled').catch(() => {});

  return set(guild.id, { enabled: false, channelId: null, noticeId: null });
}

/** staff, the owner and the bot itself are never bait. */
function exempt(message, member) {
  if (message.author.id === message.client.user.id) return true;
  if (message.author.id === message.guild.ownerId) return true;
  if (process.env.OWNER_ID?.trim() && message.author.id === process.env.OWNER_ID.trim()) return true;

  return member.permissions?.has(PermissionFlagsBits.Administrator)
    || member.permissions?.has(PermissionFlagsBits.ManageGuild)
    || member.permissions?.has(PermissionFlagsBits.ManageChannels)
    || false;
}

/**
 * message payloads carry no member without the guild members intent, and
 * `Message#member` only reads the cache — so a fresh account arrives as null.
 */
async function activeMember(message) {
  if (message.member) return message.member;

  return message.guild.members.fetch(message.author.id).catch(() => null);
}

/** act on a message that landed in the trap. */
export async function punish(message, member, record) {
  const reason = `honeypot: posted in #${message.channel?.name ?? 'the trap'}`;

  await message.delete().catch(() => {});

  if (record.punishment !== 'delete' && member) {
    if (record.punishment === 'ban') {
      await member.ban({ reason, deleteMessageSeconds: 3600 });
    } else if (record.punishment === 'softban') {
      await member.ban({ reason, deleteMessageSeconds: 86_400 });
      await message.guild.members.unban(member.id, reason).catch(() => {});
    } else if (record.punishment === 'kick') {
      await member.kick(reason);
    } else if (record.punishment === 'timeout') {
      await member.timeout(timeoutLength, reason);
    }
  }

  return bump(message.guild.id, record.punishment);
}

/** every message, cheap early-outs first. */
export function watch(client) {
  client.on(Events.MessageCreate, async (message) => {
    if (!message.guild) return;

    // bot accounts are fair game; only our own messages are not.
    if (message.author?.id === client.user.id) return;

    let record = null;

    try {
      record = await get(message.guild.id);

      if (!record.enabled || record.channelId !== message.channelId) return;

      const member = await activeMember(message);

      if (!member) {
        console.log(`[slink] honeypot • could not resolve ${message.author.id}; message left alone.`);
        return;
      }

      if (exempt(message, member)) return;

      const after = await punish(message, member, record);

      await refresh(message.guild, after);
      console.log(`[slink] honeypot • ${message.author.username} → ${record.punishment}`);
    } catch (error) {
      report(`honeypot → ${record?.punishment ?? 'trap'}`, error);
    }
  });
}
