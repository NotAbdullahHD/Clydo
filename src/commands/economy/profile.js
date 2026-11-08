import { facts, heading, payload, rule, shell } from '../../lib/card.js';
import { get, short, total } from '../../lib/economy.js';
import { since } from '../../lib/theme.js';

/** `,profile [@user]` — the wallet, then the habits behind it. */

export const name = 'profile';
export const names = ['me'];

export async function prefix(message) {
  const target = message.mentions.users.first() ?? message.author;
  const record = await get(target.id);
  const items = Object.values(record.inventory).reduce((sum, count) => sum + count, 0);
  const joined = message.member?.joinedTimestamp ?? target.createdTimestamp;

  const box = shell();
  heading(box, {
    title: target.username,
    note: `daily streak day ${record.daily.streak} · ${items} item${items === 1 ? '' : 's'}`,
    avatar: target.displayAvatarURL({ size: 256 }),
  });
  box.addSeparatorComponents(rule());
  box.addTextDisplayComponents(facts([
    ['wallet', `**${short(record.wallet)}**`],
    ['bank', `**${short(record.bank)}**`],
    ['total', `**${short(total(record))}**`],
  ]));
  box.addSeparatorComponents(rule());
  box.addTextDisplayComponents(facts([
    ['joined', since(joined)],
    ['account', since(target.createdTimestamp)],
  ]));

  await message.reply({ ...payload(box), allowedMentions: { parse: [] } });
}
