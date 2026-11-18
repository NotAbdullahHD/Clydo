import { abilities, allows, catalogue, grant, refusal, revoke, table } from '../../lib/perms.js';
import { no, ok } from '../../lib/line.js';
import { panel } from '../../lib/theme.js';

/**
 * `,fakeperms [list|grant @role <ability|all>|revoke @role [ability]]`
 */

export const name = 'fakeperms';
export const names = ['fp'];

export async function prefix(message, args) {
  if (!allows(message.member, 'fakeperms')) {
    await message.reply(no(refusal('fakeperms')));
    return;
  }

  const head = (args[0] ?? 'list').toLowerCase();
  const role = message.mentions.roles.first();
  const ability = (args[2] ?? args[1] ?? '').toLowerCase();

  if (head === 'grant') {
    if (!role || !ability) {
      await message.reply(no('usage: `,fakeperms grant @role ban` or `,fakeperms grant @role all`'));
      return;
    }

    if (ability !== 'all' && !abilities[ability]) {
      await message.reply(no(`unknown ability — one of ${catalogue()}`));
      return;
    }

    const list = grant(message.guildId, role.id, ability, ability === 'all');
    await message.reply(ok(message, `<@&${role.id}> can now use ${list.join(', ')}.`));
    return;
  }

  if (head === 'revoke') {
    if (!role) {
      await message.reply(no('usage: `,fakeperms revoke @role [ability]`'));
      return;
    }

    const left = revoke(message.guildId, role.id, ability || null);
    await message.reply(ok(message, left.length
      ? `<@&${role.id}> keeps ${left.join(', ')}.`
      : `<@&${role.id}> has no fake permissions now.`));
    return;
  }

  const rows = Object.entries(table(message.guildId));

  await message.reply({
    embeds: [panel({
      title: 'fake permissions',
      description: rows.length
        ? rows.map(([roleId, list]) => `\`›\` <@&${roleId}>  —  ${list.join(', ')}`).join('\n')
        : 'nothing granted yet.',
      footer: `abilities: ${catalogue()}`,
    })],
    allowedMentions: { parse: [] },
  });
}
