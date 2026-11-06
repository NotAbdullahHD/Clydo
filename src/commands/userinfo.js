import { ActivityType, SlashCommandBuilder } from 'discord.js';
import { panel, since, tape } from '../lib/theme.js';

const activityOf = (presence) => {
  const entry = presence?.activities?.find((item) => item.type !== ActivityType.Custom)
    ?? presence?.activities?.[0];

  if (!entry) return 'none';
  if (entry.type === ActivityType.Custom) return entry.state ?? 'custom status';

  return entry.name ?? 'none';
};

export const data = new SlashCommandBuilder()
  .setName('userinfo')
  .setDescription('account and presence data for a user')
  .addUserOption((option) =>
    option.setName('user').setDescription('defaults to you').setRequired(false),
  );

export async function execute(interaction) {
  const user = interaction.options.getUser('user') ?? interaction.user;
  const member = interaction.options.getMember('user') ?? interaction.member;

  const presence = member?.presence ?? null;
  const created = since(user.createdTimestamp);

  await interaction.reply({
    embeds: [
      panel({
        title: 'user data',
        description: tape([
          {
            heading: 'account',
            rows: [
              ['user', user.username],
              ['id', user.id],
              ['created', created],
            ],
          },
          {
            heading: 'presence',
            rows: [
              ['status', presence?.status ?? 'not shared'],
              ['activity', activityOf(presence)],
            ],
          },
        ]),
      }),
    ],
  });
}
