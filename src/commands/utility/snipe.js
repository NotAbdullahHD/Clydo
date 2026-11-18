import { GatewayIntentBits } from 'discord.js';
import { all, peek } from '../../lib/snipes.js';
import { open as pager } from '../../lib/pager.js';
import { no } from '../../lib/line.js';
import { heading, payload, quiet, rule, shell, text } from '../../lib/card.js';
import { palette, since } from '../../lib/theme.js';

/**
 * `,snipe [n]` — a deleted message, newest by default.
 */

export const name = 'snipe';
export const names = ['s'];

const contentOn = (client) => client?.options?.intents?.has?.(GatewayIntentBits.MessageContent) ?? false;

const line = (record, index) => {
  const body = record.text ? `> ${record.text.replace(/\n/g, '\n> ')}` : '> no text';
  return `**${index + 1}. ${record.author}**  ·  ${since(record.at)}\n${body}`;
};

function card(message, record) {
  const box = shell(palette.panel);
  heading(box, { title: 'snipe', note: `${record.author}  ·  ${since(record.at)}` });
  box.addSeparatorComponents(rule());
  box.addTextDisplayComponents(text(record.text || 'no text'));
  if (record.attachment) box.addTextDisplayComponents(quiet(record.attachment));
  if (!contentOn(message.client)) box.addTextDisplayComponents(quiet('message content intent is off — text may be missing'));

  return payload(box);
}

export async function prefix(message, args) {
  const history = all(message.channelId, 'delete');

  if (!history.length) {
    await message.reply(no('nothing deleted here yet.'));
    return;
  }

  const wanted = Number.parseInt(args[0] ?? '', 10);

  if (Number.isFinite(wanted) && wanted > 0) {
    const record = peek(message.channelId, 'delete', wanted - 1);

    if (!record) {
      await message.reply(no(`only ${history.length} deleted message${history.length === 1 ? '' : 's'} here.`));
      return;
    }

    await message.reply({ ...card(message, record), allowedMentions: { parse: [] } });
    return;
  }

  const pages = [];

  for (let offset = 0; offset < history.length; offset += 5) {
    pages.push(history.slice(offset, offset + 5).map((record, index) => line(record, offset + index)));
  }

  await pager(message, {
    title: 'snipe',
    note: `${history.length} deleted · try ,snipe 2`,
    pages,
  });
}
