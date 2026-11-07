import { SlashCommandBuilder } from 'discord.js';
import { panel, section, sections, since } from '../../lib/theme.js';

export const data = new SlashCommandBuilder()
  .setName('serverinfo')
  .setDescription('parameters for this server')
  .setDMPermission(false);

export async function execute(interaction) {
  const { guild } = interaction;

  await interaction.reply({
    embeds: [
      panel({
        title: 'serverinfo',
        description: sections(
          section({
            heading: 'identity',
            rows: [
              ['name', guild.name],
              ['id', guild.id],
              ['created', since(guild.createdTimestamp)],
            ],
          }),
          section({
            heading: 'metrics',
            rows: [
              ['members', guild.memberCount],
              ['boosts', `${guild.premiumSubscriptionCount ?? 0} (tier ${guild.premiumTier})`],
              ['channels', guild.channels.cache.size],
            ],
          }),
        ),
        footer: 'raw parameters. no noise.',
      }),
    ],
  });
}
