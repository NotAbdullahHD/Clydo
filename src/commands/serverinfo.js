import { SlashCommandBuilder } from 'discord.js';
import { panel, since, tape } from '../lib/theme.js';

export const data = new SlashCommandBuilder()
  .setName('serverinfo')
  .setDescription('parameters for this server')
  .setDMPermission(false);

export async function execute(interaction) {
  const { guild } = interaction;

  const created = since(guild.createdTimestamp);
  const boosts = `${guild.premiumSubscriptionCount ?? 0} (tier ${guild.premiumTier})`;

  await interaction.reply({
    embeds: [
      panel({
        title: 'server parameters',
        description: tape([
          {
            heading: 'identity',
            rows: [
              ['name', guild.name],
              ['id', guild.id],
              ['created', created],
            ],
          },
          {
            heading: 'metrics',
            rows: [
              ['members', String(guild.memberCount)],
              ['boosts', boosts],
              ['channels', String(guild.channels.cache.size)],
            ],
          },
        ]),
      }),
    ],
  });
}
