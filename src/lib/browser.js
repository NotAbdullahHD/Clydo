import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { entry, panel } from './theme.js';

/**
 * the command browser.
 *
 * a typo used to get silence. now it gets the closest command slink has, in a
 * card you can page through: prev / next / search / close. one command a page,
 * nothing more than the name, one line about it, usage, module and aliases.
 */

/** message id → the page a browser is showing, so a search and the buttons agree. */
const positions = new Map();
const window = 120_000;

/** read lazily: prefix.js imports this module, so it must not import it back. */
const commandPrefix = () => process.env.PREFIX?.trim() || ',';

const aboutOf = (client, name) => client.about?.get(name)
  ?? client.commands.get(name)?.data?.description
  ?? 'no description';

const usageOf = (client, name) => client.usage?.get(name) ?? `${commandPrefix()}${name}`;

export function entries(client) {
  return [...client.commands.keys()].sort().map((name) => ({
    name,
    module: client.categories?.get(name) ?? 'core',
    about: aboutOf(client, name),
    usage: usageOf(client, name),
    aliases: client.commands.get(name)?.names ?? [],
  }));
}

/** small edit distance, capped: typo matching should not walk long strings. */
function distance(left, right) {
  const a = left.slice(0, 32);
  const b = right.slice(0, 32);
  const rows = Array.from({ length: a.length + 1 }, (_, index) => [index]);

  for (let column = 1; column <= b.length; column += 1) rows[0][column] = column;

  for (let row = 1; row <= a.length; row += 1) {
    for (let column = 1; column <= b.length; column += 1) {
      rows[row][column] = Math.min(
        rows[row - 1][column] + 1,
        rows[row][column - 1] + 1,
        rows[row - 1][column - 1] + (a[row - 1] === b[column - 1] ? 0 : 1),
      );
    }
  }

  return rows[a.length][b.length];
}

/** the command a typo most likely meant. */
export function closest(list, query) {
  const needle = String(query ?? '').toLowerCase().trim().replace(/^[^a-z0-9]+/, '');
  if (!needle) return 0;

  const exact = list.findIndex((item) => item.name === needle || item.aliases.includes(needle));
  if (exact !== -1) return exact;

  const starts = list.findIndex((item) => item.name.startsWith(needle));
  if (starts !== -1) return starts;

  const contains = list.findIndex((item) => item.name.includes(needle));
  if (contains !== -1) return contains;

  let best = 0;
  let score = Infinity;

  list.forEach((item, index) => {
    const value = Math.min(
      distance(needle, item.name),
      ...item.aliases.map((alias) => distance(needle, alias)),
    );

    if (value < score) {
      score = value;
      best = index;
    }
  });

  return best;
}

const controls = (index, size, disabled = false) => new ActionRowBuilder().addComponents(
  new ButtonBuilder().setCustomId('browse:prev').setLabel('‹').setStyle(ButtonStyle.Secondary).setDisabled(disabled || index === 0),
  new ButtonBuilder().setCustomId('browse:next').setLabel('›').setStyle(ButtonStyle.Secondary).setDisabled(disabled || index >= size - 1),
  new ButtonBuilder().setCustomId('browse:search').setLabel('search').setStyle(ButtonStyle.Primary).setDisabled(disabled),
  new ButtonBuilder().setCustomId('browse:close').setLabel('close').setStyle(ButtonStyle.Danger).setDisabled(disabled),
);

export function build(client, index, note = null, disabled = false) {
  const list = entries(client);
  const at = Math.min(Math.max(index, 0), list.length - 1);
  const item = list[at];

  const description = [
    note ? `-# ${note}` : null,
    item.about,
    '',
    entry('usage', `\`${item.usage}\``),
    entry('module', item.module),
    item.aliases.length ? entry('aliases', item.aliases.map((alias) => `\`${alias}\``).join(', ')) : null,
  ].filter(Boolean).join('\n');

  return {
    embeds: [panel({ title: item.name, description, footer: `page ${at + 1}/${list.length}` })],
    components: [controls(at, list.length, disabled)],
  };
}

async function show(target, client, userId, index, note) {
  const message = await target.reply(build(client, index, note));
  positions.set(message.id, index);

  const collector = message.createMessageComponentCollector({
    filter: (press) => press.user.id === userId,
    time: window,
  });

  collector.on('collect', async (press) => {
    const list = entries(client);

    try {
      if (press.customId === 'browse:search') {
        await press.showModal(
          new ModalBuilder()
            .setCustomId('browse:search')
            .setTitle('find a command')
            .addComponents(
              new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                  .setCustomId('query')
                  .setLabel('command name')
                  .setStyle(TextInputStyle.Short)
                  .setMaxLength(32)
                  .setRequired(true),
              ),
            ),
        );
        return;
      }

      const current = positions.get(message.id) ?? index;

      if (press.customId === 'browse:close') {
        positions.delete(message.id);
        await press.update(build(client, current, note, true));
        collector.stop('closed');
        return;
      }

      const next = press.customId === 'browse:next'
        ? Math.min(current + 1, list.length - 1)
        : Math.max(current - 1, 0);

      positions.set(message.id, next);
      await press.update(build(client, next, note));
    } catch (error) {
      console.warn('[slink] browser skipped —', error?.message ?? error);
    }
  });

  collector.on('end', () => {
    positions.delete(message.id);
    message.edit({ components: [] }).catch(() => {});
  });

  return message;
}

/** open on the command a typo meant. */
export async function open(message, query) {
  const list = entries(message.client);
  const note = query ? `no command called ${query}` : null;

  return show(message, message.client, message.author.id, closest(list, query), note);
}

/** the search modal, routed from the interaction handler. */
export async function handleSearch(interaction, client) {
  if (!interaction.isModalSubmit?.() || interaction.customId !== 'browse:search') return false;

  const query = interaction.fields.getTextInputValue('query').trim();
  const list = entries(client);
  const at = closest(list, query);

  await interaction.deferUpdate();
  if (interaction.message) positions.set(interaction.message.id, at);
  await interaction.editReply(build(client, at, `showing ${query}`)).catch(() => {});

  return true;
}
