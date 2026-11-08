import { simple } from '../../lib/card.js';
import { confirm } from '../../lib/confirm.js';
import { get, save } from '../../lib/family.js';
import { palette } from '../../lib/theme.js';

/** `,disown @child` — remove a child from your family, after asking. */

export const name = 'disown';

export async function prefix(message) {
  const target = message.mentions.users.first();

  if (!target) {
    await message.reply(simple({ accent: palette.bad, title: 'disown', message: 'mention a child to disown.' }));
    return;
  }

  const authorData = await get(message.author.id);

  if (!authorData.children.includes(target.id)) {
    await message.reply(simple({ accent: palette.bad, title: 'disown', message: 'that user is not your child.' }));
    return;
  }

  await confirm(message, {
    title: 'disown',
    question: `remove **${target.username}** from your family?`,
    detail: 'they lose you as a parent, and your partner loses them too.',
    yes: 'disown',
    onConfirm: async (press) => {
      const mine = await get(message.author.id);
      mine.children = mine.children.filter((id) => id !== target.id);
      await save(mine);

      if (mine.partnerId) {
        const partnerData = await get(mine.partnerId);
        partnerData.children = partnerData.children.filter((id) => id !== target.id);
        await save(partnerData);
      }

      const childData = await get(target.id);
      childData.parent = null;
      await save(childData);

      await press.editReply({
        ...simple({
          title: 'disown',
          note: message.author.username,
          message: `**${target.username}** is no longer part of your family.`,
        }),
        allowedMentions: { parse: [] },
      });
    },
  });
}
