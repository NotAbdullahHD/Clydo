import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, EmbedBuilder } from 'discord.js';
import { get, save } from '../../lib/family.js';

/** `,adopt` — the standalone version, which requires being married first. */

const ok = (desc) => new EmbedBuilder().setColor(0x57F287).setDescription(desc);
const fail = (desc) => new EmbedBuilder().setColor(0xED4245).setDescription(desc);

export const name = 'adopt';

export async function prefix(message) {
  const target = message.mentions.users.first();

  if (!target) return message.reply({ embeds: [fail('Mention someone to adopt.')] });
  if (target.id === message.author.id) return message.reply({ embeds: [fail("You can't adopt yourself.")] });

  const authorData = await get(message.author.id);
  if (!authorData.partnerId) return message.reply({ embeds: [fail('You must be married to adopt.')] });
  if (authorData.children.includes(target.id)) {
    return message.reply({ embeds: [fail('They are already your child.')] });
  }

  const childData = await get(target.id);
  if (childData.parent) return message.reply({ embeds: [fail('They already have a parent.')] });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('accept').setLabel('Join Family').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('deny').setLabel('No thanks').setStyle(ButtonStyle.Danger),
  );

  const msg = await message.channel.send({
    content: `${target}`,
    embeds: [
      new EmbedBuilder()
        .setColor(0xFFB6C1)
        .setAuthor({ name: `${message.author.username} wants to adopt you`, iconURL: message.author.displayAvatarURL() })
        .setDescription(`${target}, do you accept?`),
    ],
    components: [row],
  });

  const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 30_000 });

  collector.on('collect', async (press) => {
    if (press.user.id !== target.id) {
      return press.reply({ content: "This isn't for you.", ephemeral: true });
    }

    if (press.customId === 'accept') {
      authorData.children.push(target.id);
      childData.parent = message.author.id;
      await save(authorData);
      await save(childData);

      const partnerData = await get(authorData.partnerId);

      if (partnerData && !partnerData.children.includes(target.id)) {
        partnerData.children.push(target.id);
        await save(partnerData);
      }

      await press.update({ embeds: [ok(`👶 **${target.username}** joined your family!`)], components: [] });
    } else {
      await press.update({ embeds: [fail(`**${target.username}** declined.`)], components: [] });
    }
  });

  collector.on('end', (_collected, reason) => {
    if (reason === 'time') msg.edit({ components: [] }).catch(() => {});
  });
}
