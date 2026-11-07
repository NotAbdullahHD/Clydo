import { ActivityType, Events } from 'discord.js';
import { prefix } from './prefix.js';

/**
 * presence rotation.
 *
 * three states, one at a time, shuffled every 3-5 minutes so the bot reads as
 * alive without anyone staring at a single number that barely moves:
 *
 *   watching    how many servers it sits in
 *   listening   channels that have had a message in the last ten minutes
 *   playing     a random fun command, as if it were about to queue one
 */

/** a channel stays a "conversation" this long after its last message. */
const quietAfter = 10 * 60 * 1000;

/** every rotation waits at least 3 minutes, then up to 2 more. */
const every = 3 * 60 * 1000;
const jitter = 2 * 60 * 1000;

/** channel id → last message timestamp. memory only; a restart clears it. */
const live = new Map();

/** remember which channels are actually talking. */
export function watch(client) {
  client.on(Events.MessageCreate, (message) => {
    if (!message.guild || message.author?.bot) return;
    live.set(message.channelId, Date.now());
  });
}

/** drop channels that went quiet, then count what is left. */
function conversations(now = Date.now()) {
  for (const [channel, at] of live) {
    if (now - at >= quietAfter) live.delete(channel);
  }

  return live.size;
}

/** one random prefix command out of the fun module. */
function funCommand(client) {
  const names = [...client.commands.entries()]
    .filter(([name, command]) => typeof command.prefix === 'function'
      && client.categories?.get(name) === 'fun')
    .map(([name]) => name);

  return names[Math.floor(Math.random() * names.length)] ?? 'sobs';
}

const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`;

/** the three states, in the order they rotate. */
export function states(client) {
  const communities = client.guilds.cache.size;
  const talking = conversations();

  return [
    { type: ActivityType.Watching, name: plural(communities, 'community', 'communities') },
    { type: ActivityType.Listening, name: plural(talking, 'conversation', 'conversations') },
    { type: ActivityType.Playing, name: `${prefix}${funCommand(client)}` },
  ];
}

/**
 * put the first state up now, then keep cycling. returns that first label so the
 * boot log can say what the bot is showing.
 */
export function rotate(client, log = () => {}) {
  let step = 0;

  const apply = () => {
    const list = states(client);
    const state = list[step % list.length];

    client.user.setPresence({ status: 'online', activities: [state] });
    return state.name;
  };

  /** the timers never hold the process open on their own. */
  const later = (fn) => setTimeout(fn, every + Math.random() * jitter).unref?.();

  const tick = () => {
    step += 1;
    log(`status: ${apply()}`);
    later(tick);
  };

  const first = apply();
  later(tick);

  return first;
}
