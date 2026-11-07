import { GatewayIntentBits } from 'discord.js';
import { peek } from '../../lib/snipes.js';
import { panel, section, sections, since } from '../../lib/theme.js';

/** `,snipe` — the last deleted message in this channel. */

export const name = 'snipe';

/** resolved from the portal at boot, so ask the client rather than the env. */
const contentOn = (client) =>
  client?.options?.intents?.has?.(GatewayIntentBits.MessageContent) ?? false;

export async function prefix(message) {
  const record = peek(message.channelId);

  if (!record) {
    await message.reply({
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
  if (!contentOn(message.client)) {
    rows.push(['note', 'message content intent is off — text may be missing']);
  }

  await message.reply({
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
