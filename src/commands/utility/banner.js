import { panel } from '../../lib/theme.js';

/** `,banner [@user]` — profile banner at 1024. banners are never cached, so ask. */

export const name = 'banner';

export async function prefix(message) {
  const mentioned = message.mentions.users.first() ?? message.author;
  const user = await mentioned.fetch(true).catch(() => null);

  const url = user?.bannerURL({ size: 1024 }) ?? null;

  if (!url) {
    await message.reply({
      embeds: [panel({ title: 'banner', description: `${mentioned.username} has no banner.` })],
      allowedMentions: { parse: [] },
    });
    return;
  }

  await message.reply({
    embeds: [panel({ title: `${mentioned.username}'s banner` }).setImage(url)],
    allowedMentions: { parse: [] },
  });
}
