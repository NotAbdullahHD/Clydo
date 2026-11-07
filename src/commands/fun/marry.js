import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, EmbedBuilder } from 'discord.js';
import { get, save } from '../../lib/family.js';

/** `,marry` — the standalone proposal flow, with its own wording. */

export const name = 'marry';

export async function prefix(message) {
  const target = message.mentions.users.first();
  const author = message.author;

  if (!target) return message.reply('Please mention someone to marry.');
  if (target.id === author.id) return message.reply("You can't marry yourself.");
  if (target.bot) return message.reply("You can't marry a bot.");

  const authorData = await get(author.id);
  const targetData = await get(target.id);

  if (authorData.partnerId) return message.reply('You are already married!');
  if (targetData.partnerId) return message.reply(`${target.username} is already married!`);

  const embed = new EmbedBuilder()
    .setDescription(`💍 **${target.username}**, **${author.username}** has proposed to you!\nDo you accept?`)
    .setColor(0xff73fa);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('accept').setLabel('Yes').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('deny').setLabel('No').setStyle(ButtonStyle.Danger),
  );

  const msg = await message.reply({ content: `${target}`, embeds: [embed], components: [row] });

  const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60_000 });

  collector.on('collect', async (press) => {
    if (press.user.id !== target.id) {
      return press.reply({ content: 'This is not for you.', ephemeral: true });
    }

    if (press.customId === 'deny') {
      await press.update({ content: '💔 Proposal denied.', components: [], embeds: [] });
      return collector.stop();
    }

    if (press.customId === 'accept') {
      // only partnerId changes — children and parents stay as they were.
      authorData.partnerId = target.id;
      targetData.partnerId = author.id;
      await save(authorData);
      await save(targetData);

      await press.update({
        content: null,
        embeds: [
          new EmbedBuilder()
            .setDescription(`❤️ **${author.username}** and **${target.username}** are now married!`)
            .setColor(0xff73fa),
        ],
        components: [],
      });

      collector.stop();
    }
  });

  collector.on('end', (_collected, reason) => {
    if (reason === 'time') {
      msg.edit({ content: 'Proposal timed out.', components: [] }).catch(() => {});
    }
  });
}
