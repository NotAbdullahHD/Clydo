import { PermissionFlagsBits } from 'discord.js';
import { accent, number, of, parse, reset, set } from '../../lib/paint.js';
import { no, ok } from '../../lib/line.js';
import { palette } from '../../lib/theme.js';

/**
 * `,embedcolor [#hex|avatar|reset] [server]` — the tint on your cards.
 */

export const name = 'embedcolor';
export const names = ['ecolor', 'color'];

export async function prefix(message, args) {
  const head = (args[0] ?? '').toLowerCase();
  const server = args.includes('server') || head === 'server';
  const value = args.find((arg) => arg.toLowerCase() !== 'server') ?? '';

  if (!value) {
    const mine = of('user', message.author.id);
    const guild = message.guild ? of('guild', message.guild.id) : null;
    const shown = await accent({ guildId: message.guildId, userId: message.author.id, member: message.member });

    await message.reply({
      embeds: [{
        color: shown,
        title: 'embedcolor',
        description: [
          `\`›\` yours  •  ${mine ?? 'avatar'}`,
          `\`›\` server  •  ${guild ?? 'discord grey'}`,
          `\`›\` in use  •  \`#${number(shown).toString(16).padStart(6, '0')}\``,
        ].join('\n'),
        footer: { text: '`›`,embedcolor #8d7bb4  ·  ,embedcolor avatar  ·  ,embedcolor server #2b2d31`' },
      }],
    });
    return;
  }

  if (server && !message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
    await message.reply(no('changing the server colour needs **manage server**.'));
    return;
  }

  const scope = server ? 'guild' : 'user';
  const id = server ? message.guildId : message.author.id;

  if (value.toLowerCase() === 'reset') {
    reset(scope, id);
    await message.reply(ok(message, server ? 'server colour cleared.' : 'colour cleared — your avatar decides now.'));
    return;
  }

  if (value.toLowerCase() === 'avatar') {
    reset(scope, id);
    await message.reply(ok(message, 'pulled the tint back to the avatar.'));
    return;
  }

  const hex = parse(value);

  if (!hex) {
    await message.reply(no('that is not a hex colour — `,embedcolor #8d7bb4`.'));
    return;
  }

  set(scope, id, hex);

  await message.reply({
    embeds: [{ color: number(hex), title: 'embedcolor', description: `${server ? 'server' : 'your'} colour is \`${hex}\`.` }],
  });
}
