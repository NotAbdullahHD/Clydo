import { MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { parse } from '../../lib/embed-json.js';
import { done, ephemeral, oops } from '../../lib/line.js';
import { prefix as marker } from '../../lib/prefix.js';
import { add, discard, find, place, remove, settings } from '../../lib/sticky.js';
import { panel } from '../../lib/theme.js';

/**
 * `/sticky` and `,sticky` — a message that stays at the bottom of a channel.
 *
 * the json is the same one `/embed` takes, so the builder's output works here
 * as it is. the message moves down whenever somebody talks and leaves with
 * `/sticky remove`.
 */

export const name = 'sticky';

const channelOption = (option) => option
  .setName('channel')
  .setDescription('the text channel')
  .setRequired(true);

export const data = new SlashCommandBuilder()
  .setName('sticky')
  .setDescription('keep a message at the bottom of a channel')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
  .addSubcommand((sub) => sub
    .setName('add')
    .setDescription('pin a message to the bottom of a channel')
    .addChannelOption(channelOption)
    .addStringOption((option) => option
      .setName('json')
      .setDescription('the json from the builder — /embeds on the site')
      .setRequired(true)
      .setMaxLength(6000)))
  .addSubcommand((sub) => sub
    .setName('remove')
    .setDescription('take the message down')
    .addChannelOption(channelOption));

function view(guildId) {
  const { channels } = settings(guildId);

  const lines = channels.length
    ? channels.map((entry) => `<#${entry.channelId}> — ${entry.messageId ? 'live' : 'waiting for the next message'}`)
    : ['-# off — `/sticky add #channel <json>`'];

  return {
    embeds: [panel({
      title: 'sticky',
      description: [
        `-# ${channels.length ? `${channels.length} channel${channels.length === 1 ? '' : 's'}` : 'off'}`,
        '',
        ...lines,
        '',
        '-# it moves to the bottom whenever somebody talks.',
      ].join('\n'),
    })],
  };
}

/** replace whatever a channel already had, then put the new copy up. */
async function install(guild, channelId, payload) {
  const existing = find(guild.id, channelId);

  if (existing) await discard(guild, existing);

  const sent = await place(guild, channelId, payload);
  if (!sent) return null;

  add(guild.id, { channelId, payload, messageId: sent.id });

  return sent;
}

export async function execute(interaction) {
  const sub = interaction.options.getSubcommand();
  const channel = interaction.options.getChannel('channel');

  if (!channel?.isTextBased?.()) {
    await interaction.reply(oops('pick a text channel.'));
    return;
  }

  if (sub === 'remove') {
    const existing = find(interaction.guildId, channel.id);

    if (!existing) {
      await interaction.reply(oops(`nothing is pinned in <#${channel.id}>.`));
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    await discard(interaction.guild, existing);
    remove(interaction.guildId, channel.id);

    await interaction.editReply(done(interaction, `the sticky message left <#${channel.id}>.`));
    return;
  }

  const { payload, problem } = parse(interaction.options.getString('json'));

  if (problem || !payload) {
    await interaction.reply(ephemeral(oops(problem ?? 'that json does not hold an embed.')));
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const sent = await install(interaction.guild, channel.id, payload);

  await interaction.editReply(
    sent
      ? done(interaction, `the sticky message is live in <#${channel.id}>.`)
      : oops('i cannot post in that channel.'),
  );
}

export async function prefix(message, args) {
  if (!message.member?.permissions.has(PermissionFlagsBits.ManageMessages)) {
    await message.reply(oops('you need **manage messages** for that.'));
    return;
  }

  const head = args[0]?.toLowerCase();
  const guildId = message.guild.id;
  const channel = message.mentions.channels?.first?.() ?? null;

  if (!head || !['add', 'remove'].includes(head)) {
    await message.reply(view(guildId));
    return;
  }

  if (!channel) {
    await message.reply(oops(`usage — \`${marker}sticky ${head} #channel${head === 'add' ? ' <json>' : ''}\``));
    return;
  }

  if (head === 'remove') {
    const existing = find(guildId, channel.id);

    if (!existing) {
      await message.reply(oops(`nothing is pinned in <#${channel.id}>.`));
      return;
    }

    await discard(message.guild, existing);
    remove(guildId, channel.id);

    await message.reply(done(message, `the sticky message left <#${channel.id}>.`));
    return;
  }

  // the raw tail keeps a pasted block's newlines; the channel mention is pulled
  // off the front of it, because prefix commands carry no options.
  const raw = message.content
    .slice(marker.length)
    .trim()
    .replace(/^\S+\s*/, '')
    .replace(/^add\s*/i, '');
  const body = raw.replace(/^<#\d+>\s*/, '');

  const { payload, problem } = parse(body || args.slice(2).join(' '));

  if (problem || !payload) {
    await message.reply(oops(problem ?? 'that json does not hold an embed.'));
    return;
  }

  const sent = await install(message.guild, channel.id, payload);

  await message.reply(
    sent
      ? done(message, `the sticky message is live in <#${channel.id}>.`)
      : oops('i cannot post in that channel.'),
  );
}
