import { PermissionFlagsBits } from 'discord.js';
import { facts, heading, payload, quiet, rule, shell, simple } from '../../lib/card.js';
import { set } from '../../lib/config.js';
import { blank, settings } from '../../lib/automod.js';
import { palette } from '../../lib/theme.js';

/**
 * `,automod` — three filters, one action each.
 */

export const name = 'automod';

const rules = ['invites', 'spam', 'caps'];

async function status(message) {
  const state = settings(message.guild.id);

  const box = shell();
  heading(box, { title: 'automod', note: rules.filter((rule) => state[rule]).length + '/' + rules.length + ' on' });
  box.addSeparatorComponents(rule());
  box.addTextDisplayComponents(facts(rules.map((rule) => [rule, state[rule] ? 'on' : 'off'])));
  box.addTextDisplayComponents(quiet('a caught message is deleted and answered in one line. staff are exempt.'));

  await message.reply(payload(box));
}

export async function prefix(message, args) {
  if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
    await message.reply(simple({ accent: palette.bad, title: 'automod', message: 'you need manage server for that.' }));
    return;
  }

  const head = args[0]?.toLowerCase();
  const state = settings(message.guild.id);

  if (!head) {
    await status(message);
    return;
  }

  if (head === 'off') {
    await set(message.guild.id, 'automod', { invites: false, spam: false, caps: false });
    await message.reply(simple({ accent: palette.good, title: 'automod', message: 'all three filters off.' }));
    return;
  }

  if (head === 'on') {
    await set(message.guild.id, 'automod', blank());
    await message.reply(simple({ accent: palette.good, title: 'automod', message: 'all three filters on.' }));
    return;
  }

  if (rules.includes(head)) {
    const on = args[1]?.toLowerCase() !== 'off';

    await set(message.guild.id, 'automod', { ...state, [head]: on });
    await message.reply(simple({
      accent: palette.good,
      title: 'automod',
      message: `${head} filter ${on ? 'on' : 'off'}.`,
    }));
    return;
  }

  await message.reply(simple({
    accent: palette.bad,
    title: 'automod',
    message: 'usage — `,automod <invites|spam|caps> [on|off]`, `,automod on`, `,automod off`',
  }));
}
