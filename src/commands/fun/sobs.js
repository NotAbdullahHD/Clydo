import { PermissionFlagsBits } from 'discord.js';
import { prefix as prefixChar } from '../../lib/prefix.js';
import { addSobs, board, count, setBanned, setEnabled, settings } from '../../lib/sobs.js';
import { panel } from '../../lib/theme.js';

/** prefix only. there is no slash command for sobs. */
export const name = 'sobs';

const shown = 10;

const isAdmin = (member) => member?.permissions?.has(PermissionFlagsBits.ManageGuild) ?? false;

const isOwner = (message) => {
  const botOwner = process.env.OWNER_ID?.trim();
  return message.author.id === message.guild.ownerId || (Boolean(botOwner) && message.author.id === botOwner);
};

/** one-line replies stay simple. */
const say = (text) => ({ embeds: [panel({ title: 'sobs', description: text })] });

const usage = {
  add: `usage — \`${prefixChar}sobs add <amount> @user\``,
  ban: `usage — \`${prefixChar}sobs ban @user\``,
  unban: `usage — \`${prefixChar}sobs unban @user\``,
};

export async function prefix(message, args) {
  const guild = message.guild;
  const sub = args[0]?.toLowerCase();
  const state = await settings(guild.id);

  if (sub === 'enable' || sub === 'disable') {
    if (!isAdmin(message.member) && !isOwner(message)) {
      await message.reply(say('you need manage server for that.'));
      return;
    }

    const enabled = sub === 'enable';
    await setEnabled(guild.id, enabled);

    await message.reply(say(enabled ? 'sobs are on.' : 'sobs are off.'));
    return;
  }

  if (sub === 'add') {
    if (!isAdmin(message.member) && !isOwner(message)) {
      await message.reply(say('you need manage server for that.'));
      return;
    }

    const amount = Number(args.find((arg) => /^[+-]?\d+$/.test(arg)));
    const target = message.mentions.users.first();

    if (!Number.isFinite(amount) || !target) {
      await message.reply(say(usage.add));
      return;
    }

    const total = await addSobs(guild.id, target.id, amount);

    await message.reply(say(`added **${amount}** sobs to **${target.username}** — **${total}** total.`));
    return;
  }

  if (sub === 'ban' || sub === 'unban') {
    if (!isOwner(message)) {
      await message.reply(say('only the owner can do that.'));
      return;
    }

    const target = message.mentions.users.first();

    if (!target) {
      await message.reply(say(sub === 'ban' ? usage.ban : usage.unban));
      return;
    }

    await setBanned(guild.id, target.id, sub === 'ban');

    await message.reply(say(
      sub === 'ban' ? `banned **${target.username}** from sobs.` : `unbanned **${target.username}**.`,
    ));
    return;
  }

  if (sub === 'lb' || sub === 'top' || sub === 'list') {
    const ranked = (await board(guild.id)).slice(0, shown);

    const description = ranked.length
      ? ranked
        .map((entry, index) => `**${index + 1}.** ${guild.members.cache.get(entry.userId)?.user.username ?? `<@${entry.userId}>`} — **${entry.count}** sobs`)
        .join('\n')
      : 'nothing counted here yet.';

    await message.reply({ embeds: [panel({ title: 'sobs', description, footer: 'raw sorrow. no noise.' })] });
    return;
  }

  if (!state.enabled) {
    await message.reply(say('sobs are off in this server.'));
    return;
  }

  const target = message.mentions.users.first() ?? message.author;

  if (state.banned.includes(target.id)) {
    await message.reply(say(`**${target.username}** is banned from sobs.`));
    return;
  }

  const total = await count(guild.id, target.id);

  await message.reply({
    embeds: [panel({ title: 'sobs', description: `😭 **${target.username}** has **${total}** sobs` })],
    allowedMentions: { parse: [] },
  });
}
