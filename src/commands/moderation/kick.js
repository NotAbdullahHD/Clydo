import { allows, refusal } from '../../lib/perms.js';
import { no, ok } from '../../lib/line.js';
import { panel, palette } from '../../lib/theme.js';

/**
 * `,kick @user [reason]` — dm first, then kick, one line back.
 */

export const name = 'kick';
export const names = ['boot'];

export async function prefix(message, args) {
  if (!allows(message.member, 'kick')) {
    await message.reply(no(refusal('kick')));
    return;
  }

  const member = message.mentions.members.first();
  if (!member) {
    await message.reply(no('usage: `,kick @user [reason]`'));
    return;
  }

  if (member.id === message.author.id) {
    await message.reply(no('you cannot kick yourself.'));
    return;
  }

  if (!member.kickable) {
    await message.reply(no('i cannot kick them — check role hierarchy.'));
    return;
  }

  const reason = args.slice(1).join(' ') || 'no reason given';

  await member.user.send({
    embeds: [panel({
      title: 'kicked',
      description: `**${message.guild.name}**\n\`›\` reason  —  ${reason}`,
      accent: palette.warn,
    })],
  }).catch(() => {});

  await member.kick(reason);

  await message.reply(ok(message, `**${member.user.username}** kicked — ${reason}.`));
}
