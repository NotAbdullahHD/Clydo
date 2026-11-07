import { Events } from 'discord.js';
import { award, revoke, settings } from './sobs.js';

/**
 * sobs are earned by reactions, not counted by hand: every sob emoji a message
 * collects is one sob for its author. each reactor adds one, bots included, so a
 * message reacted by five people is five sobs.
 *
 * the store keeps a ledger per reactor, so re-adding the same reaction after
 * removing it pays nothing, and taking the reaction back returns the sob.
 */

/** 😭 or any custom emoji named sob. */
const isSob = (emoji) => emoji?.name === '😭' || /^sob$/i.test(emoji?.name ?? '');

/** fetch what a partial event left out, then check it is even a candidate. */
async function resolve(reaction) {
  if (reaction.partial) await reaction.fetch();

  const { message } = reaction;
  if (!message.guildId || !isSob(reaction.emoji)) return null;

  if (!message.author) {
    await message.fetch().catch(() => {});
  }

  const author = message.author;
  if (!author || author.bot) return null;

  return { message, author };
}

export function watch(client) {
  client.on(Events.MessageReactionAdd, async (reaction, user) => {
    try {
      const found = await resolve(reaction);
      if (!found || !user?.id) return;

      const { message, author } = found;

      // your own reaction on your own message would be a free sob.
      if (user.id === author.id) return;

      const state = await settings(message.guildId);
      if (!state.enabled || state.banned.includes(author.id)) return;

      await award(message.guildId, message.id, user.id, author.id);
    } catch (error) {
      console.warn('[slink] sob reaction skipped —', error?.message ?? error);
    }
  });

  client.on(Events.MessageReactionRemove, async (reaction, user) => {
    try {
      const found = await resolve(reaction);
      if (!found || !user?.id) return;

      const { message } = found;
      if (user.id === message.author.id) return;

      await revoke(message.guildId, message.id, user.id);
    } catch (error) {
      console.warn('[slink] sob removal skipped —', error?.message ?? error);
    }
  });
}
