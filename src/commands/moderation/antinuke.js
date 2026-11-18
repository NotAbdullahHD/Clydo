import { PermissionFlagsBits } from 'discord.js';
import { save, settings } from '../../lib/antinuke.js';
import { no, ok } from '../../lib/line.js';

/**
 * `,antinuke on|off|threshold <n>|punish <strip|kick|ban>|log <#channel>|trust @user`
 */

export const name = 'antinuke';
export const names = ['an'];

export async function prefix(message, args) {
  if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
    await message.reply(no('antinuke needs **administrator**.'));
    return;
  }

  const head = (args[0] ?? 'status').toLowerCase();
  const config = settings(message.guildId);

  if (head === 'on' || head === 'off') {
    save(message.guildId, { on: head === 'on' });
    await message.reply(ok(message, `antinuke is ${head}.`));
    return;
  }

  if (head === 'threshold') {
    const value = Number.parseInt(args[1] ?? '', 10);

    if (!Number.isFinite(value) || value < 2 || value > 20) {
      await message.reply(no('the threshold is a number between 2 and 20.'));
      return;
    }

    save(message.guildId, { threshold: value });
    await message.reply(ok(message, `stopping at **${value}** actions in ten seconds.`));
    return;
  }

  if (head === 'punish') {
    const mode = (args[1] ?? '').toLowerCase();

    if (!['strip', 'kick', 'ban'].includes(mode)) {
      await message.reply(no('punishment is `strip`, `kick` or `ban`.'));
      return;
    }

    save(message.guildId, { punish: mode });
    await message.reply(ok(message, `punishing with **${mode}**.`));
    return;
  }

  if (head === 'log') {
    const channel = message.mentions.channels.first();

    if (!channel) {
      await message.reply(no('mention the channel for reports.'));
      return;
    }

    save(message.guildId, { logChannelId: channel.id });
    await message.reply(ok(message, `reporting in <#${channel.id}>.`));
    return;
  }

  if (head === 'trust' || head === 'untrust') {
    const user = message.mentions.users.first();

    if (!user) {
      await message.reply(no('mention who — they will be skipped.'));
      return;
    }

    const trusted = new Set(config.trusted);

    if (head === 'trust') trusted.add(user.id);
    else trusted.delete(user.id);

    save(message.guildId, { trusted: [...trusted] });
    await message.reply(ok(message, `${head === 'trust' ? 'trusting' : 'no longer trusting'} <@${user.id}>.`));
    return;
  }

  await message.reply({
    embeds: [{
      color: 0x2b2d31,
      title: 'antinuke',
      description: [
        `\`›\` state  •  ${config.on ? 'on' : 'off'}`,
        `\`›\` limit  •  ${config.threshold} actions in ${Math.round(config.window / 1000)}s`,
        `\`›\` punish  •  ${config.punish}`,
        `\`›\` report  •  ${config.logChannelId ? `<#${config.logChannelId}>` : 'nowhere'}`,
        `\`›\` trusted  •  ${config.trusted.length || 'none'}`,
      ].join('\n'),
      footer: { text: 'bans, kicks, channel and role deletes are counted' },
    }],
  });
}
