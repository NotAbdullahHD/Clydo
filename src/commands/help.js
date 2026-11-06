import { SlashCommandBuilder } from 'discord.js';
import { marks, panel, row, block } from '../lib/theme.js';

export const data = new SlashCommandBuilder()
  .setName('help')
  .setDescription('list everything clydo can do');

export async function execute(interaction) {
  const commands = [...interaction.client.commands.values()]
    .sort((a, b) => a.data.name.localeCompare(b.data.name))
    .map((command) => row(command.data.name, command.data.description));

  await interaction.reply({
    embeds: [
      panel({
        title: 'help',
        description: block(...commands),
        fields: [
          {
            name: marks.rule,
            value: block(row('handle', 'clydo'), row('type', 'raw, minimal, lower-case only')),
          },
        ],
        footer: 'raw type. no noise.',
      }),
    ],
  });
}
