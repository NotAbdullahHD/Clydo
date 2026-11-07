import { panel, section, sections, since } from '../../lib/theme.js';

/** `,serverinfo` — parameters for the server the message came from. */

export const name = 'serverinfo';

export async function prefix(message) {
  const { guild } = message;

  await message.reply({
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
