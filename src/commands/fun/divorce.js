import { simple } from '../../lib/card.js';
import { confirm } from '../../lib/confirm.js';
import { get, save } from '../../lib/family.js';
import { palette } from '../../lib/theme.js';

/** `,divorce` — end the marriage for both sides, after asking. */

export const name = 'divorce';

export async function prefix(message) {
  const data = await get(message.author.id);

  if (!data.partnerId) {
    await message.reply(simple({ accent: palette.bad, title: 'divorce', message: 'you are not married.' }));
    return;
  }

  const partnerId = data.partnerId;

  await confirm(message, {
    title: 'divorce',
    question: `end the marriage with <@${partnerId}>?`,
    detail: 'both sides lose the partner. nothing else changes.',
    yes: 'divorce',
    onConfirm: async (press) => {
      const mine = await get(message.author.id);
      const theirs = await get(partnerId);

      mine.partnerId = null;
      theirs.partnerId = null;

      await save(mine);
      await save(theirs);

      await press.editReply({
        ...simple({ title: 'divorce', note: message.author.username, message: `you divorced <@${partnerId}>.` }),
        allowedMentions: { parse: [] },
      });
    },
  });
}
