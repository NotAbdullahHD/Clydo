import { EmbedBuilder } from 'discord.js';
import { get, save } from '../../lib/family.js';

/** `,disown` — remove a child from your family. */

const fail = (desc) => new EmbedBuilder().setColor(0xED4245).setDescription(desc);

export const name = 'disown';

export async function prefix(message) {
  const target = message.mentions.users.first();

  if (!target) return message.reply({ embeds: [fail('Mention a child to disown.')] });

  const authorData = await get(message.author.id);
  if (!authorData.children.includes(target.id)) {
    return message.reply({ embeds: [fail('That user is not your child.')] });
  }

  authorData.children = authorData.children.filter((id) => id !== target.id);
  await save(authorData);

  if (authorData.partnerId) {
    const partnerData = await get(authorData.partnerId);

    partnerData.children = partnerData.children.filter((id) => id !== target.id);
    await save(partnerData);
  }

  const childData = await get(target.id);
  childData.parent = null;
  await save(childData);

  await message.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(0xED4245)
        .setAuthor({ name: message.author.username, iconURL: message.author.displayAvatarURL() })
        .setDescription(`🚪 **${target.username}** is no longer part of your family.`),
    ],
  });
}
