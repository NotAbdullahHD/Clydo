import { facts, heading, payload, rule, shell } from '../../lib/card.js';
import { get, short, total } from '../../lib/economy.js';

/** `,balance [@user]` — three numbers, no decoration. */

export const name = 'balance';
export const names = ['bal'];

export async function prefix(message) {
  const target = message.mentions.users.first() ?? message.author;
  const record = await get(target.id);

  const box = shell();
  heading(box, {
    title: 'balance',
    note: target.username,
    avatar: target.displayAvatarURL({ size: 256 }),
  });
  box.addSeparatorComponents(rule());
  box.addTextDisplayComponents(facts([
    ['wallet', `**${short(record.wallet)}**`],
    ['bank', `**${short(record.bank)}**`],
    ['total', `**${short(total(record))}**`],
  ]));

  await message.reply({ ...payload(box), allowedMentions: { parse: [] } });
}
