import { EmbedBuilder, MessageFlags } from 'discord.js';
import { palette } from './theme.js';

/**
 * slink error handling.
 *
 * one path for every failure: log the whole thing once, show the user a single
 * red line with a ref code they can quote back, never leave an interaction stuck
 * on "thinking…". the ref code maps a report to exactly one console entry.
 */

const code = () => Date.now().toString(36).slice(-4);

export function report(context, error) {
  const ref = code();
  console.error(`[slink] ${context} • ref ${ref} • ${new Date().toISOString()}`);
  console.error(error);
  return ref;
}

/** a second bot session answering the same interaction, or a 3s timeout. */
const expired = new Set([10062, 40060]);

const line = (ref) => new EmbedBuilder()
  .setColor(palette.bad)
  .setDescription(`that one broke — ref ${ref}`);

/** errors never wait in the channel: ephemeral, one line, nothing else. */
export async function failInteraction(interaction, error, context = 'command') {
  if (expired.has(error?.code)) {
    console.warn(`[slink] ${context} • interaction was already answered or expired.`);
    return;
  }

  const payload = { embeds: [line(report(context, error))], flags: MessageFlags.Ephemeral };

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

/** same failure path for a prefix message, which cannot be ephemeral. */
export async function failMessage(message, error, context = 'command') {
  if (expired.has(error?.code)) {
    console.warn(`[slink] ${context} • message was already gone.`);
    return;
  }

  await message
    .reply({ embeds: [line(report(context, error))], allowedMentions: { parse: [] } })
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
