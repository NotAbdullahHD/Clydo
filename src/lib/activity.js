import { Events } from 'discord.js';
import { sql } from './sqlite.js';

/**
 * what a member did, per day.
 *
 * messages and voice seconds are banked in one row per member per day, so
 * "today" is a single read and a lifetime total is a sum. voice time is only
 * written when a session ends — the seconds spent sitting in a channel right now
 * are held in memory and added by `live`, so the numbers never wait an hour.
 */

/** utc days — the whole bot speaks one clock. */
export const day = (at = Date.now()) => new Date(at).toISOString().slice(0, 10);

export function bumpMessage(guildId, userId) {
  sql()
    .prepare(`
      INSERT INTO activity (guild_id, user_id, day, messages, voice) VALUES (?, ?, ?, 1, 0)
      ON CONFLICT (guild_id, user_id, day) DO UPDATE SET messages = activity.messages + 1
    `)
    .run(guildId, userId, day());
}

export function addVoice(guildId, userId, seconds) {
  const whole = Math.floor(Number(seconds));
  if (!Number.isFinite(whole) || whole < 1) return;

  sql()
    .prepare(`
      INSERT INTO voice (guild_id, user_id, seconds) VALUES (?, ?, ?)
      ON CONFLICT (guild_id, user_id) DO UPDATE SET seconds = voice.seconds + excluded.seconds
    `)
    .run(guildId, userId, whole);

  sql()
    .prepare(`
      INSERT INTO activity (guild_id, user_id, day, messages, voice) VALUES (?, ?, ?, 0, ?)
      ON CONFLICT (guild_id, user_id, day) DO UPDATE SET voice = activity.voice + excluded.voice
    `)
    .run(guildId, userId, day(), whole);
}

export function messages(guildId, userId) {
  const total = sql()
    .prepare('SELECT COALESCE(SUM(messages), 0) AS n FROM activity WHERE guild_id = ? AND user_id = ?')
    .get(guildId, userId)?.n ?? 0;

  const today = sql()
    .prepare('SELECT messages AS n FROM activity WHERE guild_id = ? AND user_id = ? AND day = ?')
    .get(guildId, userId, day())?.n ?? 0;

  return { total, today };
}

export function voiceTime(guildId, userId) {
  const total = sql()
    .prepare('SELECT seconds AS n FROM voice WHERE guild_id = ? AND user_id = ?')
    .get(guildId, userId)?.n ?? 0;

  const today = sql()
    .prepare('SELECT voice AS n FROM activity WHERE guild_id = ? AND user_id = ? AND day = ?')
    .get(guildId, userId, day())?.n ?? 0;

  return { total, today };
}

/** open sessions, keyed `guild:user`. memory only — a restart starts the clock again. */
const sessions = new Map();
const seat = (guildId, userId) => `${guildId}:${userId}`;

/** seconds in a voice channel right now, not yet banked. */
export function live(guildId, userId) {
  const at = sessions.get(seat(guildId, userId));
  return at ? Math.max(0, Math.floor((Date.now() - at) / 1000)) : 0;
}

export function watch(client) {
  client.on(Events.VoiceStateUpdate, (oldState, newState) => {
    try {
      const guildId = newState.guild?.id ?? oldState.guild?.id;
      const userId = newState.id ?? oldState.id;
      if (!guildId || !userId) return;
      if ((newState.member ?? oldState.member)?.user?.bot) return;

      const id = seat(guildId, userId);
      const before = Boolean(oldState.channelId);
      const after = Boolean(newState.channelId);

      if (!before && after) {
        sessions.set(id, Date.now());
        return;
      }

      if (before && !after) {
        const at = sessions.get(id);
        sessions.delete(id);
        if (at) addVoice(guildId, userId, (Date.now() - at) / 1000);
      }

      // moving between channels keeps the same session, so a hop does not
      // round the time away in two tiny writes.
    } catch (error) {
      console.warn('[slink] voice clock skipped —', error?.message ?? error);
    }
  });

  client.once(Events.ClientReady, (ready) => {
    // seed whoever is already sitting in voice, so a restart banks time from now
    // instead of pretending the channel was empty.
    for (const guild of ready.guilds.cache.values()) {
      for (const channel of guild.channels.cache.values()) {
        if (!channel?.isVoiceBased?.()) continue;

        for (const member of channel.members?.values?.() ?? []) {
          if (member.user?.bot) continue;
          sessions.set(seat(guild.id, member.id), Date.now());
        }
      }
    }
  });
}
