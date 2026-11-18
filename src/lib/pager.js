import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { heading, listing, payload, quiet, rule, shell } from './card.js';

/**
 * lists page.
 *
 * nothing in slink dumps a whole table into one message: the caller hands over
 * pre-sliced pages and this renders one at a time. three grey buttons — back,
 * forward, trash — and only the person who ran the command can press them.
 */

const window = 120_000;

const controls = (at, size, disabled = false) => new ActionRowBuilder().addComponents(
  new ButtonBuilder()
    .setCustomId('page:prev')
    .setEmoji('◀')
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(disabled || at === 0),
  new ButtonBuilder()
    .setCustomId('page:next')
    .setEmoji('▶')
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(disabled || at >= size - 1),
  new ButtonBuilder()
    .setCustomId('page:close')
    .setEmoji('🗑')
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(disabled),
);

function view({ title, note, empty = 'nothing here yet.' }, pages, at, closed = false) {
  const box = shell();
  heading(box, {
    title,
    note: [note, `page ${at + 1}/${pages.length}`].filter(Boolean).join(' · '),
  });
  box.addSeparatorComponents(rule());
  box.addTextDisplayComponents(pages[at]?.length ? listing(pages[at]) : quiet(empty));
  box.addActionRowComponents(controls(at, pages.length, closed));

  return payload(box);
}

/** send the first page and keep the buttons alive for two minutes. */
export async function open(message, options) {
  const pages = options.pages?.length ? options.pages : [[]];
  let at = 0;

  const sent = await message.reply({
    ...view(options, pages, at),
    allowedMentions: { parse: [] },
  });

  const collector = sent.createMessageComponentCollector({
    filter: (press) => press.user.id === message.author.id,
    time: window,
  });

  collector.on('collect', async (press) => {
    try {
      if (press.customId === 'page:close') {
        collector.stop('closed');
        await press.update({ ...view(options, pages, at, true), allowedMentions: { parse: [] } });
        return;
      }

      if (press.customId === 'page:prev') at = Math.max(0, at - 1);
      if (press.customId === 'page:next') at = Math.min(pages.length - 1, at + 1);

      await press.update({ ...view(options, pages, at), allowedMentions: { parse: [] } });
    } catch (error) {
      console.warn('[slink] pager skipped —', error?.message ?? error);
    }
  });

  collector.on('end', (_collected, reason) => {
    if (reason === 'closed') return;
    sent.edit({ ...view(options, pages, at, true), allowedMentions: { parse: [] } }).catch(() => {});
  });

  return sent;
}
