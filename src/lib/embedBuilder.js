import { EmbedBuilder } from 'discord.js';
import { palette } from './theme.js';
import { parse as hex } from './paint.js';

/**
 * the script syntax.
 *
 * `{embed}$v{title: welcome {user.name}}$v{description: enjoy your stay}$v{color: #8d7bb4}`
 *
 * one marker, then `$v`-separated `{key: value}` blocks. a script without the
 * marker is plain text with the same variables, so `hi {user.mention}` works in
 * a welcome channel and no admin has to learn two syntaxes. values are filled
 * after parsing, so a placeholder can never be mistaken for a block.
 */

const blocks = ['title', 'description', 'color', 'author', 'footer', 'thumbnail', 'image', 'field'];

/** every placeholder a message may use, resolved from the member. */
export function variables(member, extra = {}) {
  const guild = member.guild;

  return {
    'user': `<@${member.id}>`,
    'user.mention': `<@${member.id}>`,
    'user.name': member.user?.username ?? 'someone',
    'user.display': member.displayName ?? member.user?.username ?? 'someone',
    'user.id': member.id,
    'user.avatar': member.user?.displayAvatarURL?.({ size: 256 }) ?? '',
    'server': guild?.name ?? '',
    'server.icon': guild?.iconURL?.() ?? '',
    'count': String(guild?.memberCount ?? ''),
    'boosted': member.premiumSince ? 'yes' : 'no',
    ...extra,
  };
}

/** `{user.name}` → the value; an unknown placeholder is left alone. */
export const fill = (text, vars) => String(text ?? '').replace(
  /\{([a-z.]+)\}/gi,
  (whole, key) => (key.toLowerCase() in vars ? vars[key.toLowerCase()] : whole),
);

/**
 * parse one script. returns `{ embed }`, `{ text }` for a plain sentence, or
 * `{ problem }` naming the block that is wrong.
 */
export function script(input) {
  const body = String(input ?? '').trim();

  if (!body) return { problem: 'nothing to post — write a sentence or a script.' };
  if (!/\{embed\}/i.test(body)) return { text: body };

  const chunks = body
    .replace(/\{embed\}/gi, '')
    .split(/\$v/i)
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  const embed = new EmbedBuilder().setColor(palette.panel);
  const fields = [];

  for (const chunk of chunks) {
    const found = chunk.match(/^\{([a-z]+):([\s\S]*)\}$/i);

    if (!found) return { problem: `\`${chunk.slice(0, 40)}\` is not a {key: value} block.` };

    const key = found[1].toLowerCase();
    const value = found[2].trim();

    if (!blocks.includes(key)) return { problem: `\`${key}\` is not a key — ${blocks.join(', ')}.` };

    if (key === 'title') embed.setTitle(value.slice(0, 256));
    if (key === 'description') embed.setDescription(value.slice(0, 4096));
    if (key === 'author') embed.setAuthor({ name: value.slice(0, 256) });
    if (key === 'footer') embed.setFooter({ text: value.slice(0, 2048) });
    if (key === 'thumbnail') embed.setThumbnail(value);
    if (key === 'image') embed.setImage(value);
    if (key === 'color') {
      const colour = hex(value);
      if (!colour) return { problem: `\`${value}\` is not a hex colour.` };
      embed.setColor(Number.parseInt(colour.slice(1), 16));
    }
    if (key === 'field') {
      const [name, ...rest] = value.split('|');
      if (!name?.trim() || !rest.join('|').trim()) {
        return { problem: 'a field is `{field: name | value}`.' };
      }
      fields.push({ name: name.trim().slice(0, 256), value: rest.join('|').trim().slice(0, 1024) });
    }
  }

  if (!embed.data.title && !embed.data.description && !fields.length) {
    return { problem: 'that script is empty — a title or a description is enough.' };
  }

  if (fields.length) embed.addFields(fields.slice(0, 25));

  return { embed };
}

/** the payload for a script, filled with this member's values. */
export function render(member, input, extra = {}) {
  const vars = variables(member, extra);
  const parsed = script(input);

  if (parsed.problem) return { problem: parsed.problem };
  if (parsed.text) return { payload: { content: fill(parsed.text, vars), allowedMentions: { parse: [] } } };

  const embed = parsed.embed;

  if (embed.data.title) embed.setTitle(fill(embed.data.title, vars).slice(0, 256));
  if (embed.data.description) embed.setDescription(fill(embed.data.description, vars).slice(0, 4096));
  if (embed.data.author?.name) embed.setAuthor({ name: fill(embed.data.author.name, vars).slice(0, 256) });
  if (embed.data.footer?.text) embed.setFooter({ text: fill(embed.data.footer.text, vars).slice(0, 2048) });
  if (embed.data.fields?.length) {
    embed.setFields(embed.data.fields.map((field) => ({
      ...field,
      name: fill(field.name, vars).slice(0, 256),
      value: fill(field.value, vars).slice(0, 1024),
    })));
  }

  return { payload: { embeds: [embed], allowedMentions: { parse: [] } } };
}
