import {
  ActionRowBuilder,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from 'discord.js';
import { get as appearance } from '../../lib/appearance.js';
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

function build(client, selected = home, look = null) {
  const modules = grouped(client);
  const total = client.commands.size;

  const description = selected === home
    ? ['a quiet discord bot: reactions that earn sobs, a few games, and the usual moderation.', look?.bio]
      .filter(Boolean).join('\n\n')
    : block(...(modules.get(selected) ?? []).sort()
      .map((name) => entry(name, describe(client.commands.get(name)))));

  const embed = panel({
    title: selected === home ? 'slink help' : `slink help — ${selected}`,
    description,
    fields: [
      { name: 'prefix', value: `\`${prefixChar}\``, inline: true },
      { name: 'commands', value: `\`${total}\``, inline: true },
      { name: 'modules', value: `\`${modules.size}\``, inline: true },
    ],
    footer: selected === home
      ? `use ${prefixChar}help <command> for details on a specific command`
      : undefined,
  });

  const avatar = client.user?.displayAvatarURL({ size: 256 });
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
    description: block(entry('module', module), entry('usage', `\`${usage}\``), entry('does', describe(command) || 'nothing documented')),
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

    await message.reply({
      embeds: [embed ?? panel({ title: 'help', description: `\`›\` no command called **${name}**.` })],
      allowedMentions: { parse: [] },
    });
    return;
  }

  const look = message.guild ? await appearance(message.guild.id) : null;
  const sent = await message.reply(build(message.client, home, look));
  live(sent, message.client, message.author.id, look);
}
