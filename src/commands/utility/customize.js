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
import { get, reset, set } from '../../lib/appearance.js';
import { prefix as prefixChar } from '../../lib/prefix.js';
import { palette } from '../../lib/theme.js';

/**
 * `,customize` — the panel from the reference shot, for this server only.
 *
 * avatar, banner and bio are stored per guild and worn inside the bot's own
 * embeds. the server owner sets them; nobody else can, not even the bot owner's
 * other servers' admins.
 */

export const name = 'customize';

const fields = {
  avatar: { label: 'avatar url', hint: 'direct image link', max: 400, style: TextInputStyle.Short },
  banner: { label: 'banner url', hint: 'wide image, direct link', max: 400, style: TextInputStyle.Short },
  bio: { label: 'bio', hint: 'one or two lines', max: 200, style: TextInputStyle.Paragraph },
};

const ok = (text) => new EmbedBuilder().setColor(palette.good).setDescription(`✅ ${text}`);
const no = (text) => new EmbedBuilder().setColor(palette.bad).setDescription(`❌ ${text}`);

const isOwner = (message) => message.guild?.ownerId === message.author.id
  || message.author.id === process.env.OWNER_ID?.trim();

const isUrl = (value) => /^https?:\/\/\S+$/i.test(value);

const blurb = 'Change how I appear in this server. Only the server owner can use these.';

/** the card: title, one line, the look underneath. */
function card(record) {
  const embed = new EmbedBuilder()
    .setColor(palette.panel)
    .setTitle('Customization')
    .setDescription(record.bio ? `${blurb}\n\n${record.bio}` : blurb);

  if (record.avatar) embed.setThumbnail(record.avatar);
  if (record.banner) embed.setImage(record.banner);

  return embed;
}

const buttons = () => new ActionRowBuilder().addComponents(
  new ButtonBuilder().setCustomId('customize:avatar').setLabel('Avatar').setStyle(ButtonStyle.Secondary),
  new ButtonBuilder().setCustomId('customize:banner').setLabel('Banner').setStyle(ButtonStyle.Secondary),
  new ButtonBuilder().setCustomId('customize:bio').setLabel('Bio').setStyle(ButtonStyle.Secondary),
  new ButtonBuilder().setCustomId('customize:reset').setLabel('Reset').setStyle(ButtonStyle.Danger),
);

/** the panel, with a two-minute collector so the buttons actually work. */
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
      await press.update({ embeds: [card(await reset(message.guild.id))], components: [buttons()] });
      return;
    }

    const field = press.customId.split(':')[1];
    const spec = fields[field];

    await press.showModal(new ModalBuilder()
      .setCustomId(`customize:modal:${field}`)
      .setTitle(spec.label)
      .addComponents(new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('value')
          .setLabel(spec.label)
          .setPlaceholder(spec.hint)
          .setStyle(spec.style)
          .setMaxLength(spec.max)
          .setRequired(false)
          .setValue(record[field] ?? ''),
      )));

    const submitted = await press
      .awaitModalSubmit({ filter: (modal) => modal.customId === `customize:modal:${field}`, time: 120_000 })
      .catch(() => null);

    if (!submitted) return;

    const value = submitted.fields.getTextInputValue('value').trim();

    if (value && field !== 'bio' && !isUrl(value)) {
      await submitted.reply({
        embeds: [no(`${field} needs a direct image link.`)],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const next = await set(message.guild.id, { [field]: value || null });

    await submitted.reply({
      embeds: [ok(value ? `${field} updated.` : `${field} cleared.`)],
      flags: MessageFlags.Ephemeral,
    });

    await sent.edit({ embeds: [card(next)], components: [buttons()] });
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
  const record = await get(message.guild.id);

  if (!sub) {
    await open(message, record);
    return;
  }

  if (sub === 'reset' || sub === 'clear') {
    await reset(message.guild.id);
    await message.reply({ embeds: [ok('server appearance reset.')] });
    return;
  }

  const field = sub === 'pfp' ? 'avatar' : sub;

  if (!fields[field]) {
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

  await set(message.guild.id, { [field]: input.slice(0, fields[field].max) });
  await message.reply({ embeds: [ok(`${field} updated.`)] });
}
