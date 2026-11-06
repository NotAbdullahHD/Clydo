import { Events } from 'discord.js';
import { failMessage } from './errors.js';

/**
 * prefix routing — `,sobs` and friends.
 *
 * message content is only readable with the privileged message content intent,
 * so prefix commands are inert until that is enabled; the boot log says so.
 */

export const prefix = process.env.PREFIX?.trim() || ',';

const namesOf = (command) => [command.data.name, ...(command.names ?? [])];

export function route(client) {
  client.on(Events.MessageCreate, async (message) => {
    if (!message.guild || message.author.bot) return;

    const content = message.content ?? '';
    if (!content.startsWith(prefix)) return;

    const [rawName, ...args] = content.slice(prefix.length).trim().split(/\s+/);
    const name = rawName?.toLowerCase();
    if (!name) return;

    const command = client.commands.find(
      (candidate) => typeof candidate.prefix === 'function' && namesOf(candidate).includes(name),
    );

    if (!command) return;

    try {
      await command.prefix(message, args, client);
    } catch (error) {
      await failMessage(message, error, `${prefix}${name}`);
    }
  });
}
