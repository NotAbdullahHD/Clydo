import { PermissionFlagsBits } from 'discord.js';
import { facts, heading, payload, rule, shell, simple } from '../../lib/card.js';
import { confirm } from '../../lib/confirm.js';
import { set } from '../../lib/config.js';
import { panel, settings } from '../../lib/tickets.js';
import { palette } from '../../lib/theme.js';

/**
 * `,ticket setup #channel` — one panel, private threads.
 */

export const name = 'ticket';
export const names = ['tickets', 'support'];

async function status(message) {
  const state = settings(message.guild.id);

  const box = shell();
  heading(box, { title: 'ticket', note: state.channelId ? 'on' : 'off' });
  box.addSeparatorComponents(rule());
  box.addTextDisplayComponents(facts([
    ['panel', state.channelId ? `<#${state.channelId}>` : 'none'],
    ['threads', 'private, one per member'],
  ]));

  await message.reply({ ...payload(box), allowedMentions: { parse: [] } });
}

export async function prefix(message, args) {
  const head = args[0]?.toLowerCase();
  const state = settings(message.guild.id);

  if (head === 'close') {
    if (!message.channel.isThread()) {
      await message.reply(simple({ accent: palette.bad, title: 'ticket', message: 'this is not a ticket thread.' }));
      return;
    }

    await confirm(message, {
      title: 'ticket',
      question: 'close this thread?',
      detail: 'it is locked and archived, not deleted.',
      yes: 'close',
      onConfirm: async (press) => {
        await press.editReply(simple({ accent: palette.panel, title: 'ticket', note: message.author.username, message: 'closing this thread.' }));
        await message.channel.setLocked(true).catch(() => {});
        await message.channel.setArchived(true).catch(() => {});
      },
    });
    return;
  }

  if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
    await message.reply(simple({ accent: palette.bad, title: 'ticket', message: 'you need manage server for that.' }));
    return;
  }

  if (!head || head === 'status') {
    await status(message);
    return;
  }

  if (head === 'off') {
    await set(message.guild.id, 'tickets', { channelId: null, panelId: null });
    await message.reply(simple({ accent: palette.good, title: 'ticket', message: 'ticket panel off.' }));
    return;
  }

  if (head === 'setup') {
    const channel = message.mentions.channels?.first?.() ?? message.channel;

    if (state.panelId) {
      const old = await channel.messages.fetch(state.panelId).catch(() => null);
      await old?.delete().catch(() => {});
    }

    const sent = await channel.send(panel());
    await set(message.guild.id, 'tickets', { channelId: channel.id, panelId: sent.id });

    await message.reply(simple({ accent: palette.good, title: 'ticket', message: `panel posted in <#${channel.id}>.` }));
    return;
  }

  await status(message);
}
