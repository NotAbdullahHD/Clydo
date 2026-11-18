import {
  ActionRowBuilder,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from 'discord.js';
import { of as aliasOf } from '../../lib/alias.js';
import { get as appearance } from '../../lib/appearance.js';
import { open as openBrowser } from '../../lib/browser.js';
import { facts, heading, listing, payload, quiet, rule, shell } from '../../lib/card.js';
import { prefix as prefixChar } from '../../lib/prefix.js';

/**
 * /help and ,help — the same card in both places: who slink is, how much of it
 * there is, and a menu that swaps the body to one module's commands.
 */

export const data = new SlashCommandBuilder()
  .setName('help')
  .setDescription('list everything slink can do');

export const names = ['h', 'commands'];

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
  const at = selected === home;

  const box = shell();
  heading(box, {
    title: at ? 'slink help' : `slink help — ${selected}`,
    note: at
      ? `${total} commands · ${modules.size} modules · prefix ${prefixChar}`
      : `${list.length} command${list.length === 1 ? '' : 's'} in this module`,
    avatar: at ? client.user?.displayAvatarURL({ size: 256 }) : null,
  });
  box.addSeparatorComponents(rule());

  if (at) {
    box.addTextDisplayComponents(listing([...modules.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([module, names]) => `\`›\` **${module}**  —  ${names.length} command${names.length === 1 ? '' : 's'}`)));
  } else {
    // a module is a menu, not a manual: names only, one wrapped line of them.
    box.addTextDisplayComponents(listing([list.map((name) => `\`${name}\``).join('  ')]));
  }

  if (at && look?.bio) {
    box.addSeparatorComponents(rule());
    box.addTextDisplayComponents(quiet(look.bio));
  }

  box.addTextDisplayComponents(quiet(`use ${prefixChar}help <command> for one line about it`));

  const menu = new StringSelectMenuBuilder()
    .setCustomId('help:module')
    .setPlaceholder('pick a module')
    .addOptions(
      new StringSelectMenuOptionBuilder().setLabel('home').setValue(home),
      ...[...modules.keys()].sort().map((module) => new StringSelectMenuOptionBuilder()
        .setLabel(module)
        .setValue(module)),
    );

  box.addActionRowComponents(new ActionRowBuilder().addComponents(menu));

  return payload(box);
}

function detail(client, name, guildId = null) {
  const command = client.commands.get(name);
  if (!command) return null;

  const module = client.categories?.get(name) ?? 'core';
  const usage = command.data ? `/${name}` : `${prefixChar}${name}`;
  const shorts = [
    ...(command.names ?? []).filter((short) => short !== name),
    ...(guildId ? aliasOf(guildId, name) : []),
  ];

  const box = shell();
  heading(box, { title: `slink help — ${name}` });
  box.addSeparatorComponents(rule());
  box.addTextDisplayComponents(facts([
    ['module', module],
    ['usage', `\`${usage}\``],
    ['does', describe(client, name) || 'nothing documented'],
    shorts.length ? ['also', shorts.map((short) => `\`${prefixChar}${short}\``).join('  ')] : null,
  ]));

  return payload(box);
}

function live(message, client, userId, look = null) {
  const collector = message.createMessageComponentCollector({
    filter: (press) => press.user.id === userId,
    time: 120_000,
  });

  collector.on('collect', async (press) => {
    await press.update(build(client, press.values?.[0] ?? home, look));
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
    const found = detail(message.client, name, message.guildId ?? null);

    if (!found) {
      await openBrowser(message, name);
      return;
    }

    await message.reply({ ...found, allowedMentions: { parse: [] } });
    return;
  }

  const look = message.guild ? await appearance(message.guild.id) : null;
  const sent = await message.reply(build(message.client, home, look));
  live(sent, message.client, message.author.id, look);
}
