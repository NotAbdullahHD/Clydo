import { MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { block, entry, panel } from '../../lib/theme.js';

const maxAgeDays = 14;

export const data = new SlashCommandBuilder()
  .setName('purge')
  .setDescription('clear recent messages in this channel')
  .addIntegerOption((option) =>
    option
      .setName('amount')
      .setDescription('1 to 100')
      .setMinValue(1)
      .setMaxValue(100)
      .setRequired(true),
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
  .setDMPermission(false);

export async function execute(interaction) {
  const amount = interaction.options.getInteger('amount', true);

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const deleted = await interaction.channel.bulkDelete(amount, true);
  const skipped = amount - deleted.size;

  const lines = [`cleared ${deleted.size} message${deleted.size === 1 ? '' : 's'}.`];

  if (skipped > 0) {
    lines.push('', entry('skipped', `${skipped} older than ${maxAgeDays} days`));
  }

  await interaction.editReply({
    embeds: [
      panel({
        title: 'purge',
        description: block(...lines),
        footer: `by ${interaction.user.username}`,
      }),
    ],
  });
}
