import { allows, refusal } from '../../lib/perms.js';
import { no, ok } from '../../lib/line.js';
import { panel, palette } from '../../lib/theme.js';

/**
 * `,ban @user [reason]` — dm first, then ban, one line back.
 */

export const name = 'ban';
export const names = ['banish'];

export async function prefix(message, args) {
  if (!allows(message.member, 'ban')) {
    await message.reply(no(refusal('ban')));
    return;
  }

  const member = message.mentions.members.first();
  if (!member) {
    await message.reply(no('usage: `,ban @user [reason]`'));
    return;
  }

  if (member.id === message.author.id) {
    await message.reply(no('you cannot ban yourself.'));
    return;
  }

  if (!member.bannable) {
    await message.reply(no('i cannot ban them — check role hierarchy.'));
    return;
  }

  const reason = args.slice(1).join(' ') || 'no reason given';

  await member.user.send({
    embeds: [panel({
      title: 'banned',
      description: `**${message.guild.name}**\n\`›\` reason  —  ${reason}`,
      accent: palette.bad,
    })],
  }).catch(() => {});

  await member.ban({ reason });

  await message.reply(ok(message, `**${member.user.username}** banned — ${reason}.`));
}
