import { EmbedBuilder } from 'discord.js';
import { get } from '../../lib/family.js';

/** `,tree` — partner and children for you or a mention. */

export const name = 'tree';

export async function prefix(message) {
  const user = message.mentions.users.first() ?? message.author;
  const data = await get(user.id);

  const partner = data.partnerId ? `<@${data.partnerId}>` : 'None';
  const children = data.children.length > 0 ? data.children.map((id) => `<@${id}>`).join(', ') : 'None';

  const embed = new EmbedBuilder()
    .setTitle('🌳 Family Tree')
    .setDescription(`**Partner:** ${partner}\n**Children:** ${children}`)
    .setColor(0x2f3136)
    .setFooter({ text: 'Family System' });

  await message.reply({ embeds: [embed] });
}
