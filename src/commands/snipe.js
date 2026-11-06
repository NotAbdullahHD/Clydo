import { SlashCommandBuilder } from 'discord.js';
import { peek } from '../lib/snipes.js';
import { panel, section, sections, since } from '../lib/theme.js';

const contentIntent = process.env.MESSAGE_INTENT?.trim() === 'true';

export const data = new SlashCommandBuilder()
  .setName('snipe')
  .setDescription('the last deleted message in this channel')
  .setDMPermission(false);

export async function execute(interaction) {
  const record = peek(interaction.channelId);

  if (!record) {
    await interaction.reply({
      embeds: [
        panel({
          title: 'snipe',
          description: section({ heading: 'snipes', rows: [['last', 'nothing deleted here yet']] }),
          footer: 'raw memory. no noise.',
        }),
      ],
    });
    return;
  }

  const rows = [
    ['author', `${record.author}  (${record.id})`],
    ['sent', since(record.at)],
    ['text', record.text || 'no text'],
  ];

  if (record.attachment) rows.push(['attachment', record.attachment]);
  if (!contentIntent) rows.push(['note', 'message content intent is off — text may be missing']);

  await interaction.reply({
    embeds: [
      panel({
        title: 'snipe',
        description: sections(section({ heading: 'deleted', rows })),
        footer: 'raw memory. no noise.',
      }),
    ],
    allowedMentions: { parse: [] },
  });
}
