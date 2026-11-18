import { blocker, create, edit, owned, remove } from '../../lib/booster.js';
import { no, ok } from '../../lib/line.js';

/**
 * `,boosterrole [create|color|name|icon|delete]` — one personal role per booster.
 */

export const name = 'boosterrole';
export const names = ['br'];

export async function prefix(message, args) {
  const head = (args[0] ?? 'info').toLowerCase();
  const problem = blocker(message.guild, message.member);
  const value = args.slice(1).join(' ').trim();

  if (head === 'delete' || head === 'remove') {
    const gone = await remove(message.guild, message.member);

    await message.reply(gone ? ok(message, 'your booster role is gone.') : no('you have no booster role to delete.'));
    return;
  }

  if (problem) {
    await message.reply(no(problem));
    return;
  }

  if (head === 'create') {
    const result = await create(message.guild, message.member, { name: value || null });

    if (result.error) {
      await message.reply(no(result.error));
      return;
    }

    await message.reply(ok(message, `${result.created ? 'made' : 'you already had'} <@&${result.role.id}>.`));
    return;
  }

  if (head === 'color' || head === 'colour') {
    const result = await edit(message.guild, message.member, { color: value || null });

    await message.reply(result.error ? no(result.error) : ok(message, 'colour updated.'));
    return;
  }

  if (head === 'name') {
    if (!value) {
      await message.reply(no('usage: `,boosterrole name <text>`'));
      return;
    }

    const result = await edit(message.guild, message.member, { name: value });

    await message.reply(result.error ? no(result.error) : ok(message, 'name updated.'));
    return;
  }

  if (head === 'icon') {
    const url = message.attachments.first()?.url ?? value;

    if (!url) {
      await message.reply(no('attach an image, or paste a link to one.'));
      return;
    }

    const result = await edit(message.guild, message.member, { icon: url });

    await message.reply(result.error ? no(result.error) : ok(message, 'icon updated.'));
    return;
  }

  const id = owned(message.guildId, message.author.id);

  await message.reply({
    embeds: [{
      color: 0x2b2d31,
      title: 'booster role',
      description: [
        `\`›\` yours  •  ${id ? `<@&${id}>` : 'none yet'}`,
        '`›` create  •  `,boosterrole create [name]`',
        '`›` edit  •  `,boosterrole color #hex` · `name` · `icon`',
      ].join('\n'),
      footer: { text: 'boosters only' },
    }],
  });
}
