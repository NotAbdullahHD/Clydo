import { MessageFlags } from 'discord.js';
import { panel } from './theme.js';

/**
 * clydo error handling.
 *
 * one path for every failure: log the whole thing once, show the user a short
 * monochrome panel with a ref code they can quote back, never leave an
 * interaction stuck on "thinking…".
 */

/** short code so a user report maps to exactly one console entry. */
const code = () => Date.now().toString(36).slice(-4);

/** log a failure and return its ref code. */
export function report(context, error) {
  const ref = code();
  console.error(`[clydo] ${context} • ref ${ref} • ${new Date().toISOString()}`);
  console.error(error);
  return ref;
}

/** one line of the real reason, trimmed for a footer. */
function reason(error) {
  const text = String(error?.message ?? error ?? 'unknown error')
    .replace(/\s+/g, ' ')
    .trim();

  return text.length > 140 ? `${text.slice(0, 137)}…` : text;
}

/** a second bot session answering the same interaction, or a 3s timeout. */
const expired = new Set([10062, 40060]);

/** answer whatever state the interaction is in. */
export async function failInteraction(interaction, error, context = 'command') {
  if (expired.has(error?.code)) {
    console.warn(`[clydo] ${context} • interaction was already answered or expired.`);
    return;
  }

  const ref = report(context, error);

  const payload = {
    embeds: [
      panel({
        title: 'error',
        description: `\`›\` that one broke.\n\`›\` ref ${ref}`,
        footer: reason(error),
      }),
    ],
    flags: MessageFlags.Ephemeral,
  };

  try {
    if (interaction.deferred) {
      await interaction.editReply({ embeds: payload.embeds });
      return;
    }

    if (interaction.replied) {
      await interaction.followUp(payload);
      return;
    }

    await interaction.reply(payload);
  } catch {
    // the interaction expired or the channel is gone — the log above is enough.
  }
}

/** same failure path for a prefix message. */
export async function failMessage(message, error, context = 'command') {
  if (expired.has(error?.code)) {
    console.warn(`[clydo] ${context} • message was already gone.`);
    return;
  }

  const ref = report(context, error);

  await message
    .reply({
      embeds: [
        panel({
          title: 'error',
          description: `\`›\` that one broke.\n\`›\` ref ${ref}`,
          footer: reason(error),
        }),
      ],
      allowedMentions: { parse: [] },
    })
    .catch(() => {});
}

/**
 * keep the process online. a slash-command bot has no supervisor in this setup,
 * so an escaped rejection or exception drops it offline until someone notices.
 */
export function holdOnline(log) {
  process.on('unhandledRejection', (error) => {
    log('unhandled rejection — still online.');
    console.error(error);
  });

  process.on('uncaughtException', (error) => {
    log('uncaught exception — still online, state may be off.');
    console.error(error);
  });
}
