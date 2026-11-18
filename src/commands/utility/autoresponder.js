import { add, all, remove } from '../../lib/autoresponder.js';
import { allows, refusal } from '../../lib/perms.js';
import { no, ok } from '../../lib/line.js';
import { panel } from '../../lib/theme.js';

/**
 * `,autoresponder [add <trigger> <reply>|react <trigger> <emoji>|remove <trigger>|list]`
 */

export const name = 'autoresponder';
export const names = ['ar'];

export async function prefix(message, args) {
  if (!allows(message.member, 'autoresponder')) {
    await message.reply(no(refusal('autoresponder')));
    return;
  }

  const head = (args[0] ?? 'list').toLowerCase();
  const trigger = (args[1] ?? '').toLowerCase();

  if (head === 'add' || head === 'react') {
    if (!trigger || args.length < 3) {
      await message.reply(no(head === 'add'
        ? 'usage: `,autoresponder add hello hi {user}`'
        : 'usage: `,autoresponder react hello 🔥`'));
      return;
    }

    const plan = head === 'add'
      ? { trigger, reply: args.slice(2).join(' ') }
      : { trigger, react: args[2] };

    const result = add(message.guildId, plan);

    await message.reply(result.error ? no(result.error) : ok(message, `\`${trigger}\` is armed.`));
    return;
  }

  if (head === 'remove' || head === 'delete') {
    const dropped = remove(message.guildId, trigger);

    await message.reply(dropped ? ok(message, `\`${trigger}\` is gone.`) : no('no trigger by that name.'));
    return;
  }

  const rows = all(message.guildId);

  await message.reply({
    embeds: [panel({
      title: 'triggers',
      description: rows.length
        ? rows.map((row) => `\`›\` **${row.trigger}**  —  ${row.react ? row.react : ''}${row.reply ? ` \`${row.reply}\`` : ''}`.trim()).join('\n')
        : 'nothing armed yet.',
      footer: rows.length ? `${rows.length} armed · {user} becomes the speaker` : ',autoresponder add hello hi {user}',
    })],
    allowedMentions: { parse: [] },
  });
}
