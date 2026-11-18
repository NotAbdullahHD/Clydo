import { PermissionFlagsBits } from 'discord.js';
import { no, ok, say } from '../../lib/line.js';

/**
 * `,steal <emoji|url>` and `,steal sticker <sticker|url>` — copy it into this server.
 */

export const name = 'steal';
export const names = ['addemoji', 'stealemoji'];

const emojiToken = /<(a?):([a-z0-9_~]+):(\d{17,20})>/i;
const idToken = /\d{17,20}/;

const clean = (value) => String(value ?? '').replace(/[^a-z0-9_]/gi, '').slice(0, 32);

export async function prefix(message, args) {
  if (!message.member.permissions.has(PermissionFlagsBits.ManageGuildExpressions)) {
    await message.reply(no('this needs **manage expressions**.'));
    return;
  }

  const stickerMode = (args[0] ?? '').toLowerCase() === 'sticker';
  const rest = args.slice(stickerMode ? 1 : 0);

  const quoted = message.reference
    ? await message.fetchReference().catch(() => null)
    : null;

  const pool = [
    message.content,
    quoted?.content,
    message.attachments.first()?.url,
    quoted?.attachments.first()?.url,
  ].filter(Boolean).join(' ');

  if (stickerMode) {
    const sticker = message.stickers?.first?.()
      ?? quoted?.stickers?.first?.()
      ?? null;

    const id = sticker?.id ?? pool.match(idToken)?.[0] ?? null;
    const url = sticker?.url
      ?? (rest.find((part) => /^https?:\/\//i.test(part)) ?? null)
      ?? (id ? `https://media.discordapp.net/stickers/${id}.png` : null);

    if (!url) {
      await message.reply(no('reply to a sticker, or paste its link or id.'));
      return;
    }

    const label = clean(rest.find((part) => !/^https?:\/\//i.test(part) && !idToken.test(part)) ?? sticker?.name ?? 'stolen');

    const response = await fetch(url).catch(() => null);
    if (!response?.ok) {
      await message.reply(no('i could not download that sticker.'));
      return;
    }

    const file = Buffer.from(await response.arrayBuffer());

    const made = await message.guild.stickers.create({
      file,
      name: label || 'stolen',
      tags: 'stolen',
      description: `stolen by ${message.author.username}`,
    }).catch((error) => error);

    if (made instanceof Error) {
      await message.reply(no(`discord refused the sticker — ${made.message}`));
      return;
    }

    await message.reply(ok(message, `sticker **${made.name}** added.`));
    return;
  }

  const found = pool.match(emojiToken);
  const direct = rest.find((part) => /^https?:\/\//i.test(part)) ?? null;

  if (!found && !direct) {
    await message.reply(no('reply to a custom emoji, or paste an emoji or image link.'));
    return;
  }

  const [, animated, emojiName, emojiId] = found ?? [];
  const url = direct ?? `https://cdn.discordapp.com/emojis/${emojiId}.${animated ? 'gif' : 'png'}`;
  const label = clean(rest.find((part) => !/^https?:\/\//i.test(part) && !emojiToken.test(part)) ?? emojiName ?? 'stolen');

  if (!label || label.length < 2) {
    await message.reply(no('give it a name of at least two letters.'));
    return;
  }

  const made = await message.guild.emojis.create({
    attachment: url,
    name: label,
    reason: `stolen by ${message.author.username}`,
  }).catch((error) => error);

  if (made instanceof Error) {
    await message.reply(no(`discord refused the emoji — ${made.message}`));
    return;
  }

  await message.reply(say(`${ok(message, `emoji ${made} added as \`${made.name}\`.`).content}`));
}
