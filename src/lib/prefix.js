import { Events } from 'discord.js';
import { resolve as resolveAlias } from './alias.js';
import { open as openBrowser } from './browser.js';
import { failMessage } from './errors.js';

/**
 * prefix routing — `,sobs` and friends.
 *
 * message content is only readable with the privileged message content intent,
 * so prefix commands are inert until that is enabled; the boot log says so.
 */

export const prefix = process.env.PREFIX?.trim() || ',';

/** prefix-only commands may not have slash data at all. */
const namesOf = (command) => [command.name, command.data?.name, ...(command.names ?? [])].filter(Boolean);

export function route(client) {
  client.on(Events.MessageCreate, async (message) => {
    if (!message.guild || message.author.bot) return;

    const content = message.content ?? '';
    if (!content.startsWith(prefix)) return;

    const [rawName, ...args] = content.slice(prefix.length).trim().split(/\s+/);
    const name = rawName?.toLowerCase();
    if (!name) return;

    let command = client.commands.find(
      (candidate) => typeof candidate.prefix === 'function' && namesOf(candidate).includes(name),
    );

    /* a server alias is a second name for a command that already exists. */
    if (!command && message.guildId) {
      const target = resolveAlias(message.guildId, name);
      if (target) command = client.commands.get(target);
    }

    if (!command) {
      // a typo gets the closest command rather than silence. the shape check
      // keeps casual `, hello` chatter from opening a card.
      if (/^[a-z0-9_-]{2,}$/.test(name)) {
        await openBrowser(message, name).catch(() => {});
      }
      return;
    }

    try {
      await command.prefix(message, args, client);
    } catch (error) {
      await failMessage(message, error, `${prefix}${name}`);
    }
  });
}
