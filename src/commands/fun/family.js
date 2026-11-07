import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, EmbedBuilder } from 'discord.js';
import { get, save } from '../../lib/family.js';
import { palette } from '../../lib/theme.js';

/**
 * `,family` — marry, divorce, adopt, tree and disown in one command, copied from
 * labubu with the same embeds, button labels and wording.
 */

const ok = (desc) => new EmbedBuilder().setColor(0x57F287).setDescription(desc);
const fail = (desc) => new EmbedBuilder().setColor(0xED4245).setDescription(desc);
const info = (desc) => new EmbedBuilder().setColor(palette.panel).setDescription(desc);

export const name = 'family';

export async function prefix(message, args) {
  const sub = args[0]?.toLowerCase();
  const target = message.mentions.users.first();
  const authorId = message.author.id;

  /* ── marry ───────────────────────────────────────────── */

  if (sub === 'marry') {
    if (!target) return message.reply({ embeds: [fail('Mention someone to marry.')] });
    if (target.id === authorId) return message.reply({ embeds: [fail("You can't marry yourself.")] });
    if (target.bot) return message.reply({ embeds: [fail("You can't marry a bot.")] });

    const authorData = await get(authorId);
    const targetData = await get(target.id);

    if (authorData.partnerId) return message.reply({ embeds: [fail('You are already married.')] });
    if (targetData.partnerId) return message.reply({ embeds: [fail('They are already married.')] });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('accept').setLabel('Accept').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('deny').setLabel('Decline').setStyle(ButtonStyle.Danger),
    );

    const msg = await message.channel.send({
      content: `${target}`,
      embeds: [
        new EmbedBuilder()
          .setColor(palette.panel)
          .setAuthor({ name: `${message.author.username} sent a proposal`, iconURL: message.author.displayAvatarURL() })
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
        authorData.partnerId = target.id;
        targetData.partnerId = authorId;
        await save(authorData);
        await save(targetData);

        await press.update({
          embeds: [
            new EmbedBuilder()
              .setColor(0x57F287)
              .setDescription(`💍 **${message.author.username}** and **${target.username}** are now married!`),
          ],
          components: [],
        });
      } else {
        await press.update({ embeds: [fail(`**${target.username}** declined the proposal.`)], components: [] });
      }
    });

    collector.on('end', (_collected, reason) => {
      if (reason === 'time') msg.edit({ components: [] }).catch(() => {});
    });

    return;
  }

  /* ── divorce ─────────────────────────────────────────── */

  if (sub === 'divorce') {
    const authorData = await get(authorId);
    if (!authorData.partnerId) return message.reply({ embeds: [fail('You are not married.')] });

    const partnerId = authorData.partnerId;
    const partnerData = await get(partnerId);

    authorData.partnerId = null;
    partnerData.partnerId = null;
    await save(authorData);
    await save(partnerData);

    await message.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xED4245)
          .setAuthor({ name: message.author.username, iconURL: message.author.displayAvatarURL() })
          .setDescription(`💔 You divorced <@${partnerId}>.`),
      ],
    });

    return;
  }

  /* ── adopt ───────────────────────────────────────────── */

  if (sub === 'adopt') {
    if (!target) return message.reply({ embeds: [fail('Mention someone to adopt.')] });
    if (target.id === authorId) return message.reply({ embeds: [fail("You can't adopt yourself.")] });

    const authorData = await get(authorId);
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
          .setColor(palette.panel)
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
        childData.parent = authorId;
        await save(authorData);
        await save(childData);

        if (authorData.partnerId) {
          const partnerData = await get(authorData.partnerId);

          if (!partnerData.children.includes(target.id)) {
            partnerData.children.push(target.id);
            await save(partnerData);
          }
        }

        await press.update({ embeds: [ok(`👶 **${target.username}** joined your family!`)], components: [] });
      } else {
        await press.update({ embeds: [fail(`**${target.username}** declined.`)], components: [] });
      }
    });

    collector.on('end', (_collected, reason) => {
      if (reason === 'time') msg.edit({ components: [] }).catch(() => {});
    });

    return;
  }

  /* ── tree / stats ────────────────────────────────────── */

  if (sub === 'tree' || sub === 'stats') {
    const user = target ?? message.author;
    const data = await get(user.id);

    const partner = data.partnerId ? `<@${data.partnerId}>` : 'None';
    const parent = data.parent ? `<@${data.parent}>` : 'None';
    const children = data.children.length ? data.children.map((id) => `<@${id}>`).join(', ') : 'None';

    await message.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(palette.panel)
          .setAuthor({ name: `${user.username}'s Family`, iconURL: user.displayAvatarURL() })
          .addFields(
            { name: '💍 Partner', value: partner, inline: true },
            { name: '👤 Parent', value: parent, inline: true },
            { name: '👶 Children', value: children, inline: false },
          ),
      ],
    });

    return;
  }

  /* ── disown ──────────────────────────────────────────── */

  if (sub === 'disown') {
    if (!target) return message.reply({ embeds: [fail('Mention a child to disown.')] });

    const authorData = await get(authorId);
    if (!authorData.children.includes(target.id)) {
      return message.reply({ embeds: [fail('They are not your child.')] });
    }

    authorData.children = authorData.children.filter((child) => child !== target.id);
    await save(authorData);

    if (authorData.partnerId) {
      const partnerData = await get(authorData.partnerId);

      partnerData.children = partnerData.children.filter((child) => child !== target.id);
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

    return;
  }

  await message.reply({
    embeds: [
      info('**Family Commands**\n`family marry @user` — propose\n`family divorce` — end marriage\n`family adopt @user` — adopt\n`family tree` — view family\n`family disown @user` — remove child'),
    ],
  });
}
