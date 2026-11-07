import {
  ActionRowBuilder,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from 'discord.js';
import { prefix as prefixChar } from '../../lib/prefix.js';
import { block, entry, panel } from '../../lib/theme.js';

/**
 * /help and ,help — the panel from the reference shot: title, modules count,
 * commands count, prefix, and a select menu that swaps to one module's commands.
 */

export const data = new SlashCommandBuilder()
  .setName('help')
  .setDescription('list everything clydo can do');

const home = 'home';

const moduleEmoji = (module) => ({
  fun: '🎮',
  moderation: '🔨',
  utility: '🧰',
}[module] ?? '📁');

const describe = (command) => command.data?.description
  ?? (typeof command.prefix === 'function' ? 'prefix command' : '');

function grouped(client) {
  const map = new Map();

  for (const name of client.commands.keys()) {
    const category = client.categories?.get(name) ?? 'core';
    if (!map.has(category)) map.set(category, []);
    map.get(category).push(name);
  }

  return map;
}

function build(client, selected = home) {
  const modules = grouped(client);
  const total = client.commands.size;

  const description = selected === home
    ? 'a quiet discord bot: reactions that earn sobs, a few games, and the usual moderation.'
    : block(...(modules.get(selected) ?? []).sort()
      .map((name) => entry(name, describe(client.commands.get(name)))));

  const embed = panel({
    title: selected === home ? 'clydo help' : `clydo help — ${selected}`,
    description,
    fields: [
      { name: '📋 prefix', value: `\`${prefixChar}\``, inline: true },
      { name: '{ } commands', value: `\`${total}\``, inline: true },
      { name: '▦ modules', value: `\`${modules.size}\``, inline: true },
    ],
    footer: `use ${prefixChar}help <command> for details on a specific command`,
  });

  const avatar = client.user?.displayAvatarURL({ size: 256 });
  if (avatar) embed.setThumbnail(avatar);

  const menu = new StringSelectMenuBuilder()
    .setCustomId('help:module')
    .setPlaceholder('select a module')
    .addOptions(
      new StringSelectMenuOptionBuilder().setLabel('Home').setValue(home).setEmoji('🏠'),
      ...[...modules.keys()].sort().map((module) => new StringSelectMenuOptionBuilder()
        .setLabel(module)
        .setValue(module)
        .setEmoji(moduleEmoji(module))),
    );

  return { embeds: [embed], components: [new ActionRowBuilder().addComponents(menu)] };
}

function detail(client, name) {
  const command = client.commands.get(name);
  if (!command) return null;

  const module = client.categories?.get(name) ?? 'core';
  const usage = command.data ? `/${name}` : `${prefixChar}${name}`;

  return panel({
    title: `clydo help — ${name}`,
    description: block(entry('module', module), entry('usage', `\`${usage}\``), entry('does', describe(command) || 'nothing documented')),
    footer: `use ${prefixChar}help for the full list`,
  });
}

function live(message, client, userId) {
  const collector = message.createMessageComponentCollector({
    filter: (press) => press.user.id === userId,
    time: 120_000,
  });

  collector.on('collect', async (press) => {
    await press.update(build(client, press.values?.[0] ?? home));
  });

  collector.on('end', () => {
    message.edit({ components: [] }).catch(() => {});
  });
}

export async function execute(interaction) {
  const reply = await interaction.reply({ ...build(interaction.client), fetchReply: true });
  live(reply, interaction.client, interaction.user.id);
}

export async function prefix(message, args) {
  const name = args[0]?.toLowerCase();

  if (name) {
    const embed = detail(message.client, name);

    await message.reply({
      embeds: [embed ?? panel({ title: 'help', description: `\`›\` no command called **${name}**.` })],
      allowedMentions: { parse: [] },
    });
    return;
  }

  const sent = await message.reply(build(message.client));
  live(sent, message.client, message.author.id);
}
