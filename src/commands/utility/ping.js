import { SlashCommandBuilder } from 'discord.js';
import { datapoint, block, panel, marks } from '../../lib/theme.js';

export const data = new SlashCommandBuilder()
  .setName('ping')
  .setDescription('check roundtrip and gateway latency');

export async function execute(interaction) {
  const sentAt = Date.now();

  await interaction.reply({
    embeds: [
      panel({
        title: 'ping',
        description: block(datapoint('roundtrip', 'measuring'), datapoint('gateway', 'measuring')),
      }),
    ],
  });

  const roundtrip = Date.now() - sentAt;
  const gateway = Math.max(0, Math.round(interaction.client.ws.ping));

  await interaction.editReply({
    embeds: [
      panel({
        title: 'ping',
        description: block(
          datapoint('roundtrip', `${roundtrip}ms`),
          datapoint('gateway', `${gateway}ms`),
          '',
          `\`${marks.accent}\` alive`,
        ),
      }),
    ],
  });
}
