import { SlashCommandBuilder } from 'discord.js';
import { board, sob } from '../lib/sobs.js';
import { panel, section, sections } from '../lib/theme.js';

const shown = 10;

const nameOf = (interaction, userId) =>
  interaction.guild?.members?.cache?.get(userId)?.user?.username
  ?? interaction.client?.users?.cache?.get(userId)?.username
  ?? `<@${userId}>`;

const position = (rows, userId) => {
  const index = rows.findIndex((row) => row.userId === userId);
  return index === -1 ? 'unranked' : `#${index + 1} of ${rows.length}`;
};

export const data = new SlashCommandBuilder()
  .setName('sobs')
  .setDescription('sob once, or read the count')
  .addUserOption((option) =>
    option.setName('user').setDescription('read someone else instead of sobbing').setRequired(false),
  )
  .addBooleanOption((option) =>
    option.setName('top').setDescription('show this server leaderboard').setRequired(false),
  )
  .setDMPermission(false);

export async function execute(interaction) {
  const { guild } = interaction;

  if (interaction.options.getBoolean('top')) {
    const rows = await board(guild.id);
    const ranked = rows.slice(0, shown);

    const body = ranked.length
      ? ranked.map((entry, index) => [`${index + 1}`, `${nameOf(interaction, entry.userId)}  —  ${entry.count}`])
      : [['sobs', 'nothing recorded here yet']];

    await interaction.reply({
      embeds: [
        panel({
          title: 'sobs',
          description: sections(section({ heading: 'leaderboard', rows: body })),
          footer: 'raw sorrow. no noise.',
        }),
      ],
    });
    return;
  }

  const target = interaction.options.getUser('user');

  if (target) {
    const rows = await board(guild.id);
    const entry = rows.find((row) => row.userId === target.id);

    await interaction.reply({
      embeds: [
        panel({
          title: 'sobs',
          description: section({
            heading: 'user',
            rows: [
              ['user', target.username],
              ['sobs', entry?.count ?? 0],
              ['rank', position(rows, target.id)],
            ],
          }),
          footer: 'raw sorrow. no noise.',
        }),
      ],
    });
    return;
  }

  const total = await sob(guild.id, interaction.user.id);
  const rows = await board(guild.id);

  await interaction.reply({
    embeds: [
      panel({
        title: 'sobs',
        description: section({
          heading: 'you',
          rows: [
            ['user', interaction.user.username],
            ['sobs', total],
            ['rank', position(rows, interaction.user.id)],
          ],
        }),
        footer: 'raw sorrow. no noise.',
      }),
    ],
  });
}
