import { EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import {
  create,
  exemption,
  get,
  isPunishment,
  notice,
  punishments,
  refresh,
  remove,
  set,
} from '../../lib/honeypot.js';
import { prefix as prefixChar } from '../../lib/prefix.js';
import { block, datapoint, panel, palette } from '../../lib/theme.js';

/**
 * `,honeypot` — the trap for spam bots.
 *
 * setup creates a channel nobody has a reason to type in and pins a warning.
 * the first message from an account that ignores it is answered with the
 * configured punishment, and the counter in the warning goes up.
 */

export const name = 'honeypot';

const ok = (text) => new EmbedBuilder().setColor(palette.good).setDescription(`✅ ${text}`);
const no = (text) => new EmbedBuilder().setColor(palette.bad).setDescription(`❌ ${text}`);

/** same cache trap as the watcher: a fresh member is not in cache without the intent. */
async function allowed(message) {
  const member = message.member ?? (await message.guild.members.fetch(message.author.id).catch(() => null));

  return Boolean(member?.permissions?.has(PermissionFlagsBits.ManageGuild));
}

const wording = {
  ban: 'banned',
  softban: 'softbanned',
  kick: 'kicked',
  timeout: 'timed out for ten minutes',
  delete: 'deleted, without touching the account',
};

const usage = `\`${prefixChar}honeypot setup\` creates the trap, \`${prefixChar}honeypot punishment <ban|softban|kick|timeout|delete>\` picks the answer, \`${prefixChar}honeypot message <text>\` rewrites the warning, \`${prefixChar}honeypot disable\` removes it.`;

const describe = (record) => {
  const count = record.counts[record.punishment] ?? 0;

  return panel({
    title: 'honeypot',
    description: block(
      datapoint('state', record.enabled ? `running in <#${record.channelId}>` : 'off — no trap in this server'),
      datapoint('punishment', record.enabled ? record.punishment : 'ban'),
      datapoint('notice', record.message ? 'custom' : 'default'),
      datapoint('caught', `${count} ${record.punishment}${count === 1 ? '' : 's'}`),
    ),
    footer: usage,
  });
};

/** can the bot actually do what it is promising? */
function limits(guild) {
  const me = guild.members.me;
  const missing = [];

  if (!me?.permissions.has(PermissionFlagsBits.ManageChannels)) missing.push('manage channels');
  if (!me?.permissions.has(PermissionFlagsBits.BanMembers)) missing.push('ban members');

  return missing;
}

export async function prefix(message, args) {
  if (!message.guild) return;

  const reply = (embed) => message.reply({ embeds: [embed], allowedMentions: { parse: [] } });

  if (!(await allowed(message))) {
    await reply(no('you need **manage server** to touch the honeypot.'));
    return;
  }

  const sub = args[0]?.toLowerCase();
  const rest = args.slice(1);

  if (!sub || sub === 'settings' || sub === 'status') {
    await reply(describe(await get(message.guild.id)));
    return;
  }

  if (sub === 'setup' || sub === 'enable') {
    const current = await get(message.guild.id);

    if (current.enabled) {
      await reply(no(`the trap is already running in <#${current.channelId}>. \`${prefixChar}honeypot disable\` takes it down.`));
      return;
    }

    if (message.guild.roles.everyone.permissions.has(PermissionFlagsBits.Administrator)) {
      await reply(no('**@everyone** has administrator here, so every member is exempt and can bypass the channel deny. remove it from @everyone first, otherwise the trap can never fire.'));
      return;
    }

    const missing = limits(message.guild);

    if (missing.length) {
      await reply(no(`i am missing **${missing.join('**, **')}** in this server, so the trap would not work.`));
      return;
    }

    const record = await create(message.guild, { ...current, enabled: true });

    await reply(ok(`trap set up in <#${record.channelId}>. the first message from an account that ignores the warning gets a **${record.punishment}**.`));
    return;
  }

  if (sub === 'punishment' || sub === 'punish') {
    const choice = rest[0]?.toLowerCase();

    if (!choice) {
      await reply(panel({
        title: 'honeypot punishment',
        description: block(
          datapoint('current', (await get(message.guild.id)).punishment),
          datapoint('options', punishments.join(', ')),
        ),
        footer: `${prefixChar}honeypot punishment <name>`,
      }));
      return;
    }

    if (!isPunishment(choice)) {
      await reply(no(`that is not a punishment. pick one of ${punishments.join(', ')}.`));
      return;
    }

    const record = await set(message.guild.id, { punishment: choice });

    await refresh(message.guild, record);
    await reply(ok(`whoever trips the trap is now ${wording[choice]}. the warning has been updated.`));
    return;
  }

  if (sub === 'message') {
    const text = rest.join(' ').trim();

    if (!text) {
      await reply(panel({
        title: 'honeypot message',
        description: block(
          datapoint('current', (await get(message.guild.id)).message ?? 'default'),
          datapoint('how', `\`${prefixChar}honeypot message <text>\` or \`${prefixChar}honeypot message reset\``),
        ),
      }));
      return;
    }

    if (text.toLowerCase() === 'reset' || text.toLowerCase() === 'default') {
      const record = await set(message.guild.id, { message: null });

      await refresh(message.guild, record);
      await reply(ok('the warning is back to the default wording.'));
      return;
    }

    const record = await set(message.guild.id, { message: text.slice(0, 1000) });

    await refresh(message.guild, record);
    await reply(ok(record.channelId
      ? 'warning message updated.'
      : 'saved — it will be used the next time the trap is set up.'));
    return;
  }

  if (sub === 'disable' || sub === 'off') {
    const current = await get(message.guild.id);

    if (!current.enabled) {
      await reply(no(`there is no trap running here. \`${prefixChar}honeypot setup\` starts one.`));
      return;
    }

    await remove(message.guild, current);
    await reply(ok('trap disabled and the channel removed.'));
    return;
  }

  if (sub === 'preview') {
    await reply(notice(await get(message.guild.id)));
    return;
  }

  if (sub === 'test' || sub === 'check') {
    const target = rest[0];
    const member = target
      ? await message.guild.members.fetch(target.replace(/[<@!>]/g, '')).catch(() => null)
      : (message.member ?? await message.guild.members.fetch(message.author.id).catch(() => null));

    if (!member) {
      await reply(no('could not find that member here.'));
      return;
    }

    const why = exemption(message.guild, member.id, member, message.client.user.id);
    const record = await get(message.guild.id);

    await reply(panel({
      title: 'honeypot test',
      description: block(
        datapoint('member', `<@${member.id}>`),
        datapoint('verdict', why ? `exempt — ${why}` : `would be ${wording[record.punishment]}`),
        datapoint('trap', record.enabled ? 'armed' : 'not set up'),
      ),
      footer: why === 'server owner'
        ? 'discord will not let any bot ban the owner of a server — test with a normal member.'
        : 'nothing was deleted or punished by this check.',
    }));
    return;
  }

  await reply(no(`unknown option. ${usage}`));
}
