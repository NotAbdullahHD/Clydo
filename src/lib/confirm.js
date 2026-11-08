import { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import { heading, payload, quiet, rule, shell, text, V2 } from './card.js';
import { palette } from './theme.js';

/**
 * destructive actions ask first.
 *
 * one prompt, two buttons, and only the person who ran the command can press
 * them. the prompt closes itself on cancel, on timeout and after the action
 * runs, so a stale button can never fire twice.
 */

const wait = 30_000;

export function prompt({
  title,
  question,
  detail = null,
  yes = 'yes',
  no = 'cancel',
  note = 'needs confirmation',
  disabled = false,
}) {
  const box = shell(palette.warn);
  heading(box, { title, note });
  box.addSeparatorComponents(rule());
  box.addTextDisplayComponents(text(question));
  if (detail) box.addTextDisplayComponents(quiet(detail));
  box.addActionRowComponents(new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('confirm:yes').setLabel(yes).setStyle(ButtonStyle.Danger).setDisabled(disabled),
    new ButtonBuilder().setCustomId('confirm:no').setLabel(no).setStyle(ButtonStyle.Secondary).setDisabled(disabled),
  ));

  return payload(box);
}

/** ask in the channel. `onConfirm` owns the receipt once the answer is yes. */
export async function confirm(message, {
  title,
  question,
  detail = null,
  yes = 'yes, do it',
  no = 'cancel',
  time = wait,
  onConfirm,
}) {
  const sent = await message.reply({
    ...prompt({ title, question, detail, yes, no }),
    allowedMentions: { parse: [] },
  });

  return new Promise((resolve) => {
    const collector = sent.createMessageComponentCollector({
      filter: (press) => press.user.id === message.author.id,
      time,
      max: 1,
    });

    collector.on('collect', async (press) => {
      try {
        if (press.customId === 'confirm:no') {
          await press.update(prompt({ title, question: 'cancelled.', note: 'nothing was touched', yes, no, disabled: true }));
          resolve(false);
          return;
        }

        await press.deferUpdate().catch(() => {});
        await onConfirm?.(press);
        resolve(true);
      } catch (error) {
        console.warn('[slink] confirm skipped —', error?.message ?? error);
        resolve(false);
      }
    });

    collector.on('end', (_collected, reason) => {
      if (reason !== 'time') return;

      sent
        .edit(prompt({ title, question, detail, yes, no, disabled: true, note: 'timed out — nothing was touched' }))
        .catch(() => {});
      resolve(false);
    });
  });
}

/** the same question asked on an interaction — a button press or a modal. */
export async function ask(interaction, {
  title,
  question,
  detail = null,
  yes = 'yes',
  no = 'cancel',
  time = 20_000,
}) {
  const sent = await interaction.reply({
    ...prompt({ title, question, detail, yes, no }),
    flags: V2 | MessageFlags.Ephemeral,
    fetchReply: true,
  });

  const press = await sent
    .awaitMessageComponent({ filter: (candidate) => candidate.user.id === interaction.user.id, time })
    .catch(() => null);

  if (!press) {
    await sent
      .edit(prompt({ title, question, detail, yes, no, disabled: true, note: 'timed out — nothing was touched' }))
      .catch(() => {});
    return false;
  }

  const agreed = press.customId === 'confirm:yes';

  await press
    .update(prompt({
      title,
      question: agreed ? 'confirmed.' : 'cancelled.',
      note: 'nothing else changed',
      yes,
      no,
      disabled: true,
    }))
    .catch(() => {});

  return agreed;
}
