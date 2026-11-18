import { all, drop, limit, put } from '../../lib/alias.js';
import { allows, refusal } from '../../lib/perms.js';
import { no, ok } from '../../lib/line.js';
import { panel } from '../../lib/theme.js';

/**
 * `,alias [add <short> <command>|remove <short>|list]` — a server's own shorthands.
 */

export const name = 'alias';
export const names = ['aliases'];

export async function prefix(message, args) {
  if (!allows(message.member, 'alias')) {
    await message.reply(no(refusal('alias')));
    return;
  }

  const head = (args[0] ?? 'list').toLowerCase();

  if (head === 'add' || head === 'set') {
    const short = (args[1] ?? '').toLowerCase();
    const target = (args[2] ?? '').toLowerCase();

    if (!short || !target) {
      await message.reply(no('usage: `,alias add ui userinfo`'));
      return;
    }

    if (!message.client.commands.has(target)) {
      await message.reply(no(`\`${target}\` is not a command.`));
      return;
    }

    if (message.client.commands.has(short)) {
      await message.reply(no(`\`${short}\` is already a command, so it cannot be an alias.`));
      return;
    }

    const result = put(message.guildId, short, target);

    await message.reply(result.error ? no(result.error) : ok(message, `\`${short}\` now runs \`${target}\`.`));
    return;
  }

  if (head === 'remove' || head === 'delete') {
    const short = (args[1] ?? '').toLowerCase();
    const left = drop(message.guildId, short);

    await message.reply(left ? ok(message, `\`${short}\` is gone.`) : no('no alias by that name.'));
    return;
  }

  const map = all(message.guildId);
  const rows = Object.entries(map);

  await message.reply({
    embeds: [panel({
      title: 'aliases',
      description: rows.length
        ? rows.sort(([left], [right]) => left.localeCompare(right))
          .map(([short, target]) => `\`›\` \`${short}\`  —  \`${target}\``)
          .join('\n')
        : 'this server has no aliases yet.',
      footer: `${rows.length}/${limit} · ,alias add <short> <command>`,
    })],
  });
}
