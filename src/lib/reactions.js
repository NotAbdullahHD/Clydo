import { Events } from 'discord.js';
import { addSobs, settings } from './sobs.js';

/**
 * sobs are earned by reactions, not counted by hand: every sob emoji a message
 * collects is one sob for its author. each reactor adds one, bots included, so a
 * message reacted by five people is five sobs.
 */

/** 😭 or any custom emoji named sob. */
const isSob = (emoji) => emoji?.name === '😭' || /^sob$/i.test(emoji?.name ?? '');

export function watch(client) {
  client.on(Events.MessageReactionAdd, async (reaction, user) => {
    try {
      if (reaction.partial) await reaction.fetch();

      const { message } = reaction;
      if (!message.guildId || !isSob(reaction.emoji)) return;

      if (!message.author) {
        await message.fetch().catch(() => {});
      }

      const author = message.author;
      if (!author || author.bot) return;

      // your own reaction on your own message would be a free sob.
      if (user?.id === author.id) return;

      const state = await settings(message.guildId);
      if (!state.enabled || state.banned.includes(author.id)) return;

      await addSobs(message.guildId, author.id, 1);
    } catch (error) {
      console.warn('[clydo] sob reaction skipped —', error?.message ?? error);
    }
  });
}
