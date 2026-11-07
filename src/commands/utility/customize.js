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
import { bio as readBio, defaults, remember, setBio } from '../../lib/appearance.js';
import { prefix as prefixChar } from '../../lib/prefix.js';
import { palette } from '../../lib/theme.js';

/**
 * `,customize` — the panel from the reference shot.
 *
 * avatar and banner are applied to the bot itself, so they change everywhere:
 * discord keeps one face per application, not one per server. the bio is stored
 * per guild and shown on the help panel. the server owner runs all of it.
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

const footnote = 'avatar and banner are one image for the whole bot — discord has no per-server face.';

/** the card: the line from the screenshot, the bio, four buttons. */
function card(record) {
  const embed = new EmbedBuilder()
    .setColor(palette.panel)
    .setTitle('Customization')
    .setDescription(record.bio ? `${blurb}\n\n${record.bio}` : blurb)
    .setFooter({ text: footnote });

  return embed;
}

const buttons = () => new ActionRowBuilder().addComponents(
  new ButtonBuilder().setCustomId('customize:avatar').setLabel('Avatar').setStyle(ButtonStyle.Secondary),
  new ButtonBuilder().setCustomId('customize:banner').setLabel('Banner').setStyle(ButtonStyle.Secondary),
  new ButtonBuilder().setCustomId('customize:bio').setLabel('Bio').setStyle(ButtonStyle.Secondary),
  new ButtonBuilder().setCustomId('customize:reset').setLabel('Reset').setStyle(ButtonStyle.Danger),
);

/** true when the change landed, otherwise the reason it did not. */
async function apply(client, field, input) {
  await remember(
    client.user?.avatarURL?.({ size: 1024 }) ?? null,
    client.user?.bannerURL?.({ size: 1024 }) ?? null,
  );

  try {
    if (field === 'avatar') await client.user.setAvatar(input);
    else await client.user.setBanner(input);

    return true;
  } catch (error) {
    const reason = String(error?.message ?? 'unknown error');
    return /rate/i.test(reason)
      ? 'discord is rate limiting that — try again later.'
      : `could not set the ${field}: ${reason.slice(0, 80)}`;
  }
}

/** put the shipped face back and clear this server's bio. */
async function wipe(client, guildId) {
  await setBio(guildId, null);

  const saved = await defaults();

  if (saved.avatar) await client.user?.setAvatar(saved.avatar).catch(() => {});
  if (saved.banner) await client.user?.setBanner(saved.banner).catch(() => {});
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
      await wipe(message.client, message.guild.id);
      await press.update({ embeds: [card(await readBio(message.guild.id))], components: [buttons()] });
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

    if (field === 'bio') {
      await setBio(message.guild.id, value);
      await submitted.reply({
        embeds: [ok(value ? 'bio updated.' : 'bio cleared.')],
        flags: MessageFlags.Ephemeral,
      });

      await sent.edit({ embeds: [card(await readBio(message.guild.id))], components: [buttons()] });
      return;
    }

    if (!value) {
      await submitted.reply({ embeds: [no(`give me a ${field} link.`)], flags: MessageFlags.Ephemeral });
      return;
    }

    if (!isUrl(value)) {
      await submitted.reply({ embeds: [no(`${field} needs a direct image link.`)], flags: MessageFlags.Ephemeral });
      return;
    }

    const applied = await apply(message.client, field, value);

    await submitted.reply({
      embeds: [applied === true ? ok(`${field} updated.`) : no(applied)],
      flags: MessageFlags.Ephemeral,
    });

    await sent.edit({ embeds: [card(await readBio(message.guild.id))], components: [buttons()] });
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
    await open(message, await readBio(message.guild.id));
    return;
  }

  if (sub === 'reset' || sub === 'clear') {
    await wipe(message.client, message.guild.id);
    await message.reply({ embeds: [ok('appearance reset.')] });
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

  if (field === 'bio') {
    await setBio(message.guild.id, input.slice(0, maxBio));
    await message.reply({ embeds: [ok('bio updated.')] });
    return;
  }

  if (!isUrl(input)) {
    await message.reply({ embeds: [no(`${field} needs a direct image link.`)] });
    return;
  }

  const applied = await apply(message.client, field, input);

  await message.reply({ embeds: [applied === true ? ok(`${field} updated.`) : no(applied)] });
}
