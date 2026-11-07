import { block, marks, panel } from '../../lib/theme.js';

/**
 * `,ship <@user> [@user]` — a compatibility score for two people.
 *
 * the number is a hash of the two ids in sorted order, so the same pair always
 * lands on the same score and mentioning them the other way round changes
 * nothing. a joke that rerolls every time is just noise.
 */

export const name = 'ship';

const bands = [
  [95, 'these two are basically a perfect match.'],
  [80, 'there is something here.'],
  [60, 'worth a shot.'],
  [40, 'the odds are against it.'],
  [20, 'this one needs luck.'],
  [0, 'absolutely not.'],
];

const caption = (percent) => (percent >= 100
  ? 'the algorithm has nothing left to say about this.'
  : bands.find(([floor]) => percent >= floor)[1]);

const score = (first, second) => {
  if (first === second) return 100;

  let hash = 2166136261;

  for (const char of [first, second].sort().join(':')) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }

  return Math.abs(hash) % 101;
};

const bar = (percent) => {
  const cells = 12;
  const filled = Math.round((percent / 100) * cells);

  return `${'━'.repeat(filled)}${'─'.repeat(cells - filled)}`;
};

/** mentions first, then bare ids, so `,ship @a @b` and `,ship 123 456` both work. */
async function resolve(message, args) {
  const users = [...message.mentions.users.values()];

  for (const arg of args) {
    const id = arg.replace(/[<@!>]/g, '');

    if (!/^\d{17,20}$/.test(id) || users.some((user) => user.id === id)) continue;

    const user = await message.client.users.fetch(id).catch(() => null);
    if (user) users.push(user);
  }

  return users.slice(0, 2);
}

export async function prefix(message, args) {
  if (!message.guild) return;

  const found = await resolve(message, args);

  if (found.length === 0) {
    await message.reply({
      embeds: [
        panel({
          title: 'ship',
          description: block(
            `${marks.accent} who am i shipping?`,
            `${marks.accent} \`,ship @user\` pairs them with you — \`,ship @one @two\` pairs two people.`,
          ),
        }),
      ],
      allowedMentions: { parse: [] },
    });
    return;
  }

  const first = found[0] ?? message.author;
  const second = found[1] ?? message.author;
  const percent = score(first.id, second.id);

  const embed = panel({
    title: 'ship',
    description: block(`**${percent}%**`, `\`${bar(percent)}\``),
  })
    .setAuthor({
      name: `${first.username} ♥ ${second.username}`,
      iconURL: first.displayAvatarURL({ size: 128, extension: 'png' }),
    })
    .setThumbnail(second.displayAvatarURL({ size: 256, extension: 'png' }))
    .setFooter({ text: caption(percent) });

  await message.reply({ embeds: [embed], allowedMentions: { parse: [] } });
}
