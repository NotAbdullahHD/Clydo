import { all, peek } from '../../lib/snipes.js';
import { open as pager } from '../../lib/pager.js';
import { no } from '../../lib/line.js';
import { heading, payload, quiet, rule, shell, text } from '../../lib/card.js';
import { palette, since } from '../../lib/theme.js';

/**
 * `,editsnipe [n]` — a message that was edited, before and after.
 */

export const name = 'editsnipe';
export const names = ['es'];

const block = (value) => `> ${String(value || 'no text').replace(/\n/g, '\n> ')}`;

export async function prefix(message, args) {
  const history = all(message.channelId, 'edit');

  if (!history.length) {
    await message.reply(no('nothing has been edited here yet.'));
    return;
  }

  const wanted = Number.parseInt(args[0] ?? '', 10);

  if (Number.isFinite(wanted) && wanted > 0) {
    const record = peek(message.channelId, 'edit', wanted - 1);

    if (!record) {
      await message.reply(no(`only ${history.length} edit${history.length === 1 ? '' : 's'} here.`));
      return;
    }

    const box = shell(palette.panel);
    heading(box, { title: 'editsnipe', note: `${record.author}  ·  ${since(record.at)}` });
    box.addSeparatorComponents(rule());
    box.addTextDisplayComponents(text(`**before**\n${block(record.before)}\n\n**after**\n${block(record.after)}`));
    box.addTextDisplayComponents(quiet('message content intent off? edits will look empty'));

    await message.reply({ ...payload(box), allowedMentions: { parse: [] } });
    return;
  }

  const pages = [];

  for (let offset = 0; offset < history.length; offset += 4) {
    pages.push(history.slice(offset, offset + 4).map((record, index) => (
      `**${offset + index + 1}. ${record.author}**  ·  ${since(record.at)}\n${block(record.before)}\n-# became\n${block(record.after)}`
    )));
  }

  await pager(message, { title: 'editsnipe', note: `${history.length} edit${history.length === 1 ? '' : 's'}`, pages });
}
