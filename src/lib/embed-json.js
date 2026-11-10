import { EmbedBuilder, MessageFlags } from 'discord.js';

/**
 * the json the embed builder hands out.
 *
 * discord's own shape is taken as it comes: a bare embed, `{ "embeds": [ … ] }`,
 * an array, or a components v2 payload. this module only refuses what discord
 * would refuse anyway — a sentence here beats a 400 from the api — and strips
 * the code fence that copying always brings along.
 */

export const V2 = MessageFlags.IsComponentsV2;

export const fence = (text) => String(text ?? '')
  .trim()
  .replace(/^```(?:json)?\s*/i, '')
  .replace(/```\s*$/, '')
  .trim();

/** everything discord would reject in an embed, said in one line. */
export function inspect({ data: embed }) {
  const strings = [
    ['title', embed.title, 256],
    ['description', embed.description, 4096],
    ['author name', embed.author?.name, 256],
    ['footer', embed.footer?.text, 2048],
  ];

  for (const [label, value, limit] of strings) {
    if (typeof value === 'string' && value.length > limit) {
      return `the ${label} is too long — ${value.length}/${limit}.`;
    }
  }

  if (!embed.title && !embed.description && !embed.fields?.length) {
    return 'that embed is empty — a title or a description is enough to start.';
  }

  const fields = embed.fields ?? [];

  if (fields.length > 25) return `that is ${fields.length} fields — discord takes 25.`;

  for (const field of fields) {
    if (!field.name || !field.value) return 'every field needs a name and a value.';
    if (field.name.length > 256) return `a field name is too long — ${field.name.length}/256.`;
    if (field.value.length > 1024) return `a field value is too long — ${field.value.length}/1024.`;
  }

  const total = [
    embed.title,
    embed.description,
    embed.author?.name,
    embed.footer?.text,
    ...fields.flatMap((field) => [field.name, field.value]),
  ].filter(Boolean).join('').length;

  if (total > 6000) return `the whole embed is ${total}/6000 characters.`;

  return null;
}

/** the container the builder emits — 10 text, 14 rule, 9 section, 11 thumb, 17 box. */
export function inspectV2(components) {
  if (!Array.isArray(components) || !components.length) return 'that json has no components.';
  if (components.length > 10) return `that is ${components.length} top-level components — discord takes 10.`;

  const allowed = new Set([1, 9, 10, 11, 12, 13, 14, 17]);
  let count = 0;
  let problem = null;

  const walk = (node) => {
    if (problem || !node || typeof node !== 'object') return;

    count += 1;

    if (!allowed.has(node.type)) {
      problem = `component type ${node.type} is not something a message can hold.`;
      return;
    }

    if (node.type === 10 && typeof node.content === 'string' && node.content.length > 4000) {
      problem = `one text block is ${node.content.length}/4000 characters.`;
      return;
    }

    if (node.type === 17 && typeof node.accent_color === 'string') {
      const hex = node.accent_color.trim().replace('#', '');
      if (/^[0-9a-f]{6}$/i.test(hex)) node.accent_color = parseInt(hex, 16);
    }

    if (node.type === 17 && !node.components?.length) {
      problem = 'that container has nothing in it — put a text block inside.';
      return;
    }

    if (Array.isArray(node.components)) node.components.forEach(walk);
    if (node.accessory) walk(node.accessory);
  };

  components.forEach(walk);

  if (problem) return problem;
  if (count > 40) return `that is ${count} components — discord takes 40.`;

  return null;
}

/**
 * `{ payload }` ready to send, or `{ problem }` in one sentence. a v2 payload
 * comes back with its flag and no pings, exactly like an embed does.
 */
export function parse(text) {
  const body = fence(text);

  if (!body) return { problem: 'nothing was pasted — copy the json from the builder.' };

  let raw;

  try {
    raw = JSON.parse(body);
  } catch {
    return { problem: 'that is not json — copy it from the builder again.' };
  }

  if (Array.isArray(raw)) [raw] = raw;
  else if (Array.isArray(raw?.embeds)) [raw] = raw.embeds;

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { problem: 'that json does not hold an embed.' };
  }

  if (Array.isArray(raw.components)) {
    const problem = inspectV2(raw.components);
    if (problem) return { problem };

    return {
      payload: { components: raw.components, flags: V2, allowedMentions: { parse: [] } },
    };
  }

  // the builder emits an int, but a hex from anywhere else is fine too.
  if (typeof raw.color === 'string' && /^#?[0-9a-f]{6}$/i.test(raw.color.trim())) {
    raw.color = parseInt(raw.color.trim().replace('#', ''), 16);
  }

  let embed;

  try {
    embed = EmbedBuilder.from(raw);
  } catch (error) {
    return { problem: `discord would reject that — ${error.message}` };
  }

  const problem = inspect(embed);
  return problem
    ? { problem }
    : { payload: { embeds: [embed], allowedMentions: { parse: [] } } };
}
