import {
  ActionRowBuilder,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from 'discord.js';
import { get as appearance } from '../../lib/appearance.js';
import { open as openBrowser } from '../../lib/browser.js';
import { prefix as prefixChar } from '../../lib/prefix.js';
import { block, entry, panel } from '../../lib/theme.js';

/**
 * /help and ,help — the panel from the reference shot: title, modules count,
 * commands count, prefix, and a select menu that swaps to one module's commands.
 */

export const data = new SlashCommandBuilder()
  .setName('help')
  .setDescription('list everything slink can do');

const home = 'home';

const describe = (client, name) => client.about?.get(name)
  ?? client.commands.get(name)?.data?.description
  ?? (typeof client.commands.get(name)?.prefix === 'function' ? 'prefix command' : '');

function grouped(client) {
  const map = new Map();

  for (const name of client.commands.keys()) {
    const category = client.categories?.get(name) ?? 'core';
    if (!map.has(category)) map.set(category, []);
    map.get(category).push(name);
  }

  return map;
}

export function build(client, selected = home, look = null) {
  const modules = grouped(client);
  const total = client.commands.size;
  const list = [...(modules.get(selected) ?? [])].sort();

  // a module listing is a menu, not a manual: names only, one wrapped line of
  // them. anyone who wants a description asks for that one command.
  const description = selected === home
    ? ['a quiet discord bot: reactions that earn sobs, a few games, and the usual moderation.', look?.bio]
      .filter(Boolean).join('\n\n')
    : list.map((name) => `\`${name}\``).join('  ');

  const embed = panel({
    title: selected === home ? 'slink help' : `slink help — ${selected} (${list.length})`,
    description,
    fields: selected === home
      ? [
        { name: 'prefix', value: `\`${prefixChar}\``, inline: true },
        { name: 'commands', value: `\`${total}\``, inline: true },
        { name: 'modules', value: `\`${modules.size}\``, inline: true },
      ]
      : [],
    footer: selected === home
      ? `use ${prefixChar}help <command> for details on a specific command`
      : `use ${prefixChar}help <command> for one line about it`,
  });

  // the avatar is identity, not decoration — home only.
  const avatar = selected === home ? client.user?.displayAvatarURL({ size: 256 }) : null;
  if (avatar) embed.setThumbnail(avatar);

  const menu = new StringSelectMenuBuilder()
    .setCustomId('help:module')
    .setPlaceholder('pick a module')
    .addOptions(
      new StringSelectMenuOptionBuilder().setLabel('home').setValue(home),
      ...[...modules.keys()].sort().map((module) => new StringSelectMenuOptionBuilder()
        .setLabel(module)
        .setValue(module)),
    );

  return { embeds: [embed], components: [new ActionRowBuilder().addComponents(menu)] };
}

function detail(client, name) {
  const command = client.commands.get(name);
  if (!command) return null;

  const module = client.categories?.get(name) ?? 'core';
  const usage = command.data ? `/${name}` : `${prefixChar}${name}`;

  return panel({
    title: `slink help — ${name}`,
    description: block(entry('module', module), entry('usage', `\`${usage}\``), entry('does', describe(client, name) || 'nothing documented')),
  });
}

function live(message, client, userId, look = null) {
  const collector = message.createMessageComponentCollector({
    filter: (press) => press.user.id === userId,
    time: 120_000,
  });

  collector.on('collect', async (press) => {
    await press.update(build(client, press.values?.[0] ?? home, look));
  });

  collector.on('end', () => {
    message.edit({ components: [] }).catch(() => {});
  });
}

export async function execute(interaction) {
  const look = interaction.guildId ? await appearance(interaction.guildId) : null;
  const reply = await interaction.reply({ ...build(interaction.client, home, look), fetchReply: true });
  live(reply, interaction.client, interaction.user.id, look);
}

export async function prefix(message, args) {
  const name = args[0]?.toLowerCase();

  if (name) {
    const embed = detail(message.client, name);

    if (!embed) {
      await openBrowser(message, name);
      return;
    }

    await message.reply({
      embeds: [embed],
      allowedMentions: { parse: [] },
    });
    return;
  }

  const look = message.guild ? await appearance(message.guild.id) : null;
  const sent = await message.reply(build(message.client, home, look));
  live(sent, message.client, message.author.id, look);
}
