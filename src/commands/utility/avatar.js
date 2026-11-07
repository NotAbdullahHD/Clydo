import { panel } from '../../lib/theme.js';

/** `,avatar [@user]` — their avatar at 1024. */

export const name = 'avatar';

export async function prefix(message) {
  const user = message.mentions.users.first() ?? message.author;

  await message.reply({
    embeds: [
      panel({ title: `${user.username}'s avatar` }).setImage(user.displayAvatarURL({ size: 1024 })),
    ],
    allowedMentions: { parse: [] },
  });
}
