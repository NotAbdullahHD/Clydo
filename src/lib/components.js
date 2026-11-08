import {
  CommandInteraction,
  ComponentType,
  ContainerBuilder,
  DMChannel,
  MediaGalleryBuilder,
  Message,
  MessageComponentInteraction,
  MessageFlags,
  ModalSubmitInteraction,
  NewsChannel,
  PartialGroupDMChannel,
  SectionBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  StageChannel,
  TextChannel,
  TextDisplayBuilder,
  ThumbnailBuilder,
  ThreadChannel,
  VoiceChannel,
} from 'discord.js';
import { palette } from './theme.js';

/**
 * components v2.
 *
 * discord's new message surface: a container with an accent rail, text
 * displays, sections, separators and media galleries. opting in means the
 * message cannot carry content, embeds, stickers or polls — everything is a
 * component — and an edit can never opt back out.
 *
 * commands still build embeds, because that language (title, description,
 * fields, footer) is what they were written in. this module translates an
 * embed into the same information as a container, and patches the handful of
 * send/reply/edit methods once at boot so every reply in the bot is v2 without
 * touching 50 command files.
 */

const V2 = MessageFlags.IsComponentsV2;
const EPHEMERAL = MessageFlags.Ephemeral;
const ROW = ComponentType.ActionRow;
const CONTAINER = ComponentType.Container;

/** discord's hard limits, kept a little short of the edge. */
const TEXT_BUDGET = 3800;
const COMPONENT_BUDGET = 38;
const CONTAINER_BUDGET = 5;

/** status colours keep their meaning; everything else stays panel grey, because
 * a rail on every card is decoration, and slink does not decorate. */
const statuses = new Set([palette.good, palette.bad, palette.warn]);
const accentFor = (color) => (statuses.has(color) ? color : palette.panel);

/** accept an EmbedBuilder, an APIEmbed or a bare object. */
function dataOf(embed) {
  if (!embed) return null;
  if (typeof embed.toJSON === 'function') return embed.toJSON();
  return embed.data ?? embed;
}

/** one text display, clipped so the message stays inside discord's budget. */
function makeText(content, budget) {
  const value = String(content ?? '').trim();
  if (!value) return null;

  const room = TEXT_BUDGET - budget.chars;
  if (room < 8) return null;

  const clipped = value.length > room ? `${value.slice(0, room - 1)}…` : value;
  budget.chars += clipped.length;

  return new TextDisplayBuilder().setContent(clipped);
}

function containerFromEmbed(embed, budget) {
  const data = dataOf(embed);
  if (!data) return null;

  budget.components += 1;
  const container = new ContainerBuilder().setAccentColor(accentFor(data.color));

  const lead = [
    data.author?.name ? makeText(`-# ${data.author.name}`, budget) : null,
    data.title ? makeText(`## ${data.title}`, budget) : null,
    data.description ? makeText(data.description, budget) : null,
  ].filter(Boolean);

  const thumb = data.thumbnail?.url;

  if (thumb && lead.length && budget.components + 2 <= COMPONENT_BUDGET) {
    const head = lead.slice(0, 3);
    container.addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(...head)
        .setThumbnailAccessory(new ThumbnailBuilder().setURL(thumb)),
    );
    budget.components += head.length + 1;

    for (const extra of lead.slice(3)) {
      if (budget.components >= COMPONENT_BUDGET) break;
      container.addTextDisplayComponents(extra);
      budget.components += 1;
    }
  } else {
    for (const text of lead) {
      if (budget.components >= COMPONENT_BUDGET) break;
      container.addTextDisplayComponents(text);
      budget.components += 1;
    }
  }

  for (const field of data.fields ?? []) {
    if (budget.components + 2 > COMPONENT_BUDGET) break;

    const body = makeText(`**${field.name}**\n${field.value}`, budget);
    if (!body) break;

    container.addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true),
    );
    container.addTextDisplayComponents(body);
    budget.components += 2;
  }

  if (data.image?.url && budget.components < COMPONENT_BUDGET) {
    container.addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems({ media: { url: data.image.url } }),
    );
    budget.components += 1;
  }

  if (data.footer?.text) {
    const foot = makeText(`-# ${data.footer.text}`, budget);
    if (foot && budget.components < COMPONENT_BUDGET) {
      container.addTextDisplayComponents(foot);
      budget.components += 1;
    }
  }

  return container;
}

/** is this message already a v2 message? */
function isV2(holder) {
  const flags = holder?.flags ?? holder?.message?.flags;
  return Boolean(flags && typeof flags.has === 'function' && flags.has(V2));
}

const asJSON = (component) => (typeof component?.toJSON === 'function' ? component.toJSON() : component);

/**
 * swap the action rows of an existing v2 message while keeping its text.
 *
 * a v2 message with no components at all is not a valid message, so clearing a
 * select menu cannot mean "remove everything" — the cards have to survive and
 * only the rows are replaced.
 */
function keepCards(target, rows) {
  const source = (target?.components ?? []).map(asJSON).filter(Boolean);
  const cards = source
    .filter((component) => component.type === CONTAINER)
    .map((card) => ({
      ...card,
      components: (card.components ?? []).filter((child) => child.type !== ROW),
    }));

  if (!cards.length) return null;

  const last = cards[cards.length - 1];
  last.components = [...(last.components ?? []), ...rows.map(asJSON)];

  return cards;
}

/**
 * turn any payload carrying embeds into a v2 payload.
 *
 * `target` is the message or interaction being edited — when it is already v2
 * and the payload only changes components or text, the existing cards are
 * preserved instead of being dropped.
 */
/** a card for a reply that carried nothing but a sentence. */
function cardFromText(value) {
  const budget = { chars: 0, components: 1 };
  const text = makeText(value, budget);
  if (!text) return null;

  return new ContainerBuilder().setAccentColor(accentFor()).addTextDisplayComponents(text);
}

export function convert(input, { target = null, fresh = true } = {}) {
  // bare strings are replies too; without this the bot still sends legacy
  // messages for every one-line answer and the look is half converted.
  if (typeof input === 'string') {
    const card = fresh ? cardFromText(input) : null;
    return card ? { components: [card], flags: V2 } : input;
  }

  if (!input || typeof input !== 'object' || input.raw) return input;

  const embeds = Array.isArray(input.embeds) ? input.embeds.filter(Boolean) : [];
  const content = typeof input.content === 'string' ? input.content.trim() : '';
  const rows = Array.isArray(input.components) ? input.components.filter(Boolean) : [];
  const editing = isV2(target);

  if (!content && !embeds.length) {
    if (editing && input.components) {
      const cards = keepCards(target, rows);
      if (cards) {
        const { components: _old, ...rest } = input;
        return { ...rest, components: cards, flags: (Number(input.flags) || 0) | V2 };
      }
    }

    return input;
  }

  // edits only convert when the message is already a card or the edit carries
  // an embed; old messages keep the surface they were sent with.
  if (!embeds.length && !fresh && !editing) return input;

  const budget = { chars: 0, components: 0 };
  const cards = [];

  for (const embed of embeds.slice(0, CONTAINER_BUDGET)) {
    const card = containerFromEmbed(embed, budget);
    if (card) cards.push(card);
  }

  if (content) {
    const text = makeText(content, budget);

    if (text) {
      if (cards.length) cards[0].spliceComponents(0, 0, text);
      else cards.push(new ContainerBuilder().setAccentColor(accentFor()).addTextDisplayComponents(text));
    }
  }

  if (rows.length) {
    if (!cards.length) cards.push(new ContainerBuilder().setAccentColor(accentFor()));
    cards[cards.length - 1].addActionRowComponents(...rows);
  }

  if (!cards.length) return input;

  const {
    content: _content,
    embeds: _embeds,
    poll: _poll,
    stickers: _stickers,
    tts: _tts,
    components: _components,
    ...rest
  } = input;

  return {
    ...rest,
    components: cards,
    flags: (Number(input.flags) || 0) | V2,
  };
}

/** every method that can carry a payload, and whether it edits an existing message. */
const targets = [
  [Message, 'reply', false],
  [Message, 'edit', true],
  [TextChannel, 'send', false],
  [DMChannel, 'send', false],
  [ThreadChannel, 'send', false],
  [VoiceChannel, 'send', false],
  [NewsChannel, 'send', false],
  [StageChannel, 'send', false],
  [PartialGroupDMChannel, 'send', false],
  [CommandInteraction, 'reply', false],
  [CommandInteraction, 'followUp', false],
  [CommandInteraction, 'editReply', true],
  [MessageComponentInteraction, 'reply', false],
  [MessageComponentInteraction, 'followUp', false],
  [MessageComponentInteraction, 'editReply', true],
  [MessageComponentInteraction, 'update', true],
  [ModalSubmitInteraction, 'reply', false],
  [ModalSubmitInteraction, 'followUp', false],
  [ModalSubmitInteraction, 'editReply', true],
];

const patched = new WeakSet();

/**
 * patch once per original function. shared prototypes (the interaction bases
 * cover every concrete interaction class) are wrapped a single time.
 */
export function install() {
  let count = 0;

  for (const [owner, method, edits] of targets) {
    const proto = owner?.prototype;
    const original = proto?.[method];

    // a subclass can inherit an already wrapped method; wrapping that again
    // would convert the same payload twice, so the wrapper carries a mark.
    if (typeof original !== 'function' || original.slinkV2 || patched.has(original)) continue;
    patched.add(original);

    const wrapper = function slinkV2(payload, ...rest) {
      return original.call(this, convert(payload, { target: edits ? this : null, fresh: !edits }), ...rest);
    };
    wrapper.slinkV2 = true;

    proto[method] = wrapper;

    count += 1;
  }

  return count;
}

export { V2 as componentsV2Flag, EPHEMERAL };
