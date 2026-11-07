import { EmbedBuilder } from 'discord.js';
import { get, save } from '../../lib/family.js';

/** `,divorce` — end the marriage for both sides. */

const fail = (desc) => new EmbedBuilder().setColor(0xED4245).setDescription(desc);

export const name = 'divorce';

export async function prefix(message) {
  const data = await get(message.author.id);
  if (!data.partnerId) return message.reply({ embeds: [fail('You are not married.')] });

  const partnerId = data.partnerId;
  const partnerData = await get(partnerId);

  data.partnerId = null;
  partnerData.partnerId = null;
  await save(data);
  await save(partnerData);

  await message.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(0xED4245)
        .setAuthor({ name: message.author.username, iconURL: message.author.displayAvatarURL() })
        .setDescription(`💔 You divorced <@${partnerId}>.`),
    ],
  });
}
