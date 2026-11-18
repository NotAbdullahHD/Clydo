import { all } from '../../lib/snipes.js';
import { open as pager } from '../../lib/pager.js';
import { no } from '../../lib/line.js';
import { heading, listing, payload, rule, shell } from '../../lib/card.js';
import { palette, since } from '../../lib/theme.js';

/**
 * `,reactionsnipe [n]` — reactions somebody took back.
 */

export const name = 'reactionsnipe';
export const names = ['rs'];

const row = (record, index) => `${index + 1}. ${record.emoji}  **${record.by}**  on ${record.author}’s message  ·  ${since(record.at)}`;

export async function prefix(message, args) {
  const history = all(message.channelId, 'reaction');

  if (!history.length) {
    await message.reply(no('no reactions have been removed here yet.'));
    return;
  }

  const wanted = Number.parseInt(args[0] ?? '', 10);

  if (Number.isFinite(wanted) && wanted > 0) {
    const record = history[wanted - 1];

    if (!record) {
      await message.reply(no(`only ${history.length} removed reaction${history.length === 1 ? '' : 's'} here.`));
      return;
    }

    const box = shell(palette.panel);
    heading(box, { title: 'reactionsnipe', note: since(record.at) });
    box.addSeparatorComponents(rule());
    box.addTextDisplayComponents(listing([row(record, 0), '', `-# message ${record.messageId}`]));

    await message.reply({ ...payload(box), allowedMentions: { parse: [] } });
    return;
  }

  const pages = [];

  for (let offset = 0; offset < history.length; offset += 8) {
    pages.push(history.slice(offset, offset + 8).map((record, index) => row(record, offset + index)));
  }

  await pager(message, {
    title: 'reactionsnipe',
    note: `${history.length} removed`,
    pages,
  });
}
