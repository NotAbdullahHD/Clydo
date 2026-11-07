import { ActivityType } from 'discord.js';
import { panel, section, sections, since } from '../../lib/theme.js';

/** `,userinfo [@user]` — account and presence data, defaults to you. */

export const name = 'userinfo';

/** discord's raw status keys read badly in a text block. */
const statuses = Object.freeze({
  online: 'online',
  idle: 'idle',
  dnd: 'do not disturb',
  offline: 'offline',
});

const activityOf = (presence) => {
  const entry = presence?.activities?.find((item) => item.type !== ActivityType.Custom)
    ?? presence?.activities?.[0];

  if (!entry) return 'none';
  if (entry.type === ActivityType.Custom) return entry.state ?? 'custom status';

  return entry.name ?? 'none';
};

export async function prefix(message) {
  const user = message.mentions.users.first() ?? message.author;
  const member = message.mentions.members.first() ?? message.member;

  const presence = member?.presence ?? null;
  const rows = [
    ['user', user.username],
    ['id', user.id],
    ['created', since(user.createdTimestamp)],
  ];

  await message.reply({
    embeds: [
      panel({
        title: 'userinfo',
        description: sections(
          section({ heading: 'account', rows }),
          section({
            heading: 'presence',
            // with the intent off, discord sends no presence at all — say that
            // once instead of printing a status and a fake "none" activity.
            rows: presence
              ? [['status', statuses[presence.status] ?? presence.status], ['activity', activityOf(presence)]]
              : [['status', 'not shared']],
          }),
        ),
        footer: 'raw data. no noise.',
      }),
    ],
  });
}
