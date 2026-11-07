import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { apply, get, reset } from '../../lib/appearance.js';
import { prefix as prefixChar } from '../../lib/prefix.js';
import { palette } from '../../lib/theme.js';

/**
 * `,customize` — the panel from the reference shot.
 *
 * avatar, banner and bio are sent to modify current member, so they apply to
 * this guild only; every other server keeps the stock look. the server owner is
 * the only one who can change any of it.
 */

export const name = 'customize';

const maxBio = 200;
const maxImage = 400;

const ok = (text) => new EmbedBuilder().setColor(palette.good).setDescription(`✅ ${text}`);
const no = (text) => new EmbedBuilder().setColor(palette.bad).setDescription(`❌ ${text}`);

const isOwner = (message) => message.guild?.ownerId === message.author.id
  || message.author.id === process.env.OWNER_ID?.trim();

const isUrl = (value) => /^https?:\/\/\S+$/i.test(value);

const blurb = 'Change how I appear in this server. Only the server owner can use these.';

const footnote = 'these apply to this server only.';

/** the card: the line from the screenshot, the bio, four buttons. */
function card(record) {
  return new EmbedBuilder()
    .setColor(palette.panel)
    .setTitle('Customization')
    .setDescription(record.bio ? `${blurb}\n\n${record.bio}` : blurb)
    .setFooter({ text: footnote });
}

const buttons = () => new ActionRowBuilder().addComponents(
  new ButtonBuilder().setCustomId('customize:avatar').setLabel('Avatar').setStyle(ButtonStyle.Secondary),
  new ButtonBuilder().setCustomId('customize:banner').setLabel('Banner').setStyle(ButtonStyle.Secondary),
  new ButtonBuilder().setCustomId('customize:bio').setLabel('Bio').setStyle(ButtonStyle.Secondary),
  new ButtonBuilder().setCustomId('customize:reset').setLabel('Reset').setStyle(ButtonStyle.Danger),
);

/** true when it landed, otherwise the reason it did not. */
async function change(client, guildId, patch) {
  try {
    await apply(client, guildId, patch);
    return true;
  } catch (error) {
    const reason = String(error?.message ?? 'unknown error');

    if (/rate/i.test(reason)) return 'discord is rate limiting that — try again later.';
    if (/too large/i.test(reason)) return 'that image is too big — keep it under 5MB.';
    if (/not an image|could not download/i.test(reason)) return reason;

    return `could not update the profile: ${reason.slice(0, 80)}`;
  }
}

/** the panel, with a two-minute collector so the buttons work. */
async function open(message, record) {
  const sent = await message.reply({ embeds: [card(record)], components: [buttons()] });

  const collector = sent.createMessageComponentCollector({
    filter: (press) => press.user.id === message.author.id,
    time: 120_000,
  });

  collector.on('collect', async (press) => {
    if (!isOwner(message)) {
      await press.reply({ embeds: [no('only the server owner can do that.')], flags: MessageFlags.Ephemeral });
      return;
    }

    if (press.customId === 'customize:reset') {
      const wiped = await change(message.client, message.guild.id, { avatar: null, banner: null, bio: null });

      if (wiped !== true) {
        await press.reply({ embeds: [no(wiped)], flags: MessageFlags.Ephemeral });
        return;
      }

      await press.update({ embeds: [card(await get(message.guild.id))], components: [buttons()] });
      return;
    }

    const field = press.customId.split(':')[1];
    const current = field === 'bio' ? record.bio ?? '' : '';

    await press.showModal(new ModalBuilder()
      .setCustomId(`customize:modal:${field}`)
      .setTitle(field === 'bio' ? 'bio' : `${field} url`)
      .addComponents(new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('value')
          .setLabel(field === 'bio' ? 'bio' : `${field} link`)
          .setPlaceholder(field === 'bio' ? 'one or two lines' : 'direct image link or upload')
          .setStyle(field === 'bio' ? TextInputStyle.Paragraph : TextInputStyle.Short)
          .setMaxLength(field === 'bio' ? maxBio : maxImage)
          .setRequired(false)
          .setValue(current),
      )));

    const submitted = await press
      .awaitModalSubmit({ filter: (modal) => modal.customId === `customize:modal:${field}`, time: 120_000 })
      .catch(() => null);

    if (!submitted) return;

    const value = submitted.fields.getTextInputValue('value').trim();

    if (value && field !== 'bio' && !isUrl(value) && !value.startsWith('data:image/')) {
      await submitted.reply({
        embeds: [no(`${field} needs a direct image link.`)],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const landed = await change(message.client, message.guild.id, { [field]: value || null });

    await submitted.reply({
      embeds: [landed === true ? ok(value ? `${field} updated.` : `${field} cleared.`) : no(landed)],
      flags: MessageFlags.Ephemeral,
    });

    await sent.edit({ embeds: [card(await get(message.guild.id))], components: [buttons()] });
  });

  collector.on('end', () => {
    sent.edit({ components: [] }).catch(() => {});
  });
}

export async function prefix(message, args) {
  if (!message.guild) return;

  if (!isOwner(message)) {
    await message.reply({ embeds: [no('only the server owner can use this.')], allowedMentions: { parse: [] } });
    return;
  }

  const sub = args[0]?.toLowerCase();

  if (!sub) {
    await open(message, await get(message.guild.id));
    return;
  }

  if (sub === 'reset' || sub === 'clear') {
    const wiped = await change(message.client, message.guild.id, { avatar: null, banner: null, bio: null });
    await message.reply({ embeds: [wiped === true ? ok('appearance reset.') : no(wiped)] });
    return;
  }

  const field = sub === 'pfp' ? 'avatar' : sub;

  if (!['avatar', 'banner', 'bio'].includes(field)) {
    await message.reply({
      embeds: [no(`usage — \`${prefixChar}customize [avatar|banner|bio|reset]\``)],
      allowedMentions: { parse: [] },
    });
    return;
  }

  const input = (message.attachments?.first?.()?.url ?? args.slice(1).join(' ')).trim();

  if (!input) {
    await message.reply({
      embeds: [no(field === 'bio' ? 'give me a line of text.' : `give me a ${field} link or upload an image.`)],
    });
    return;
  }

  if (field !== 'bio' && !isUrl(input)) {
    await message.reply({ embeds: [no(`${field} needs a direct image link.`)] });
    return;
  }

  const landed = await change(message.client, message.guild.id, { [field]: input.slice(0, field === 'bio' ? maxBio : maxImage) });

  await message.reply({ embeds: [landed === true ? ok(`${field} updated.`) : no(landed)] });
}
