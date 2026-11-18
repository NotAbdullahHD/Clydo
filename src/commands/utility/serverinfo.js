import { facts, heading, payload, picture, quiet, rule, shell } from '../../lib/card.js';
import { since } from '../../lib/theme.js';

/** `,serverinfo` — parameters for the server the message came from. */

export const name = 'serverinfo';
export const names = ['si', 'guildinfo'];

export async function prefix(message) {
  const { guild } = message;
  const boosts = guild.premiumSubscriptionCount ?? 0;

  const box = shell();
  heading(box, {
    title: guild.name,
    note: `${guild.memberCount} members · tier ${guild.premiumTier} · ${boosts} boost${boosts === 1 ? '' : 's'}`,
    avatar: guild.iconURL({ size: 256 }),
  });
  box.addSeparatorComponents(rule());
  box.addTextDisplayComponents(facts([
    ['owner', `<@${guild.ownerId}>`],
    ['created', since(guild.createdTimestamp)],
    ['channels', guild.channels.cache.size],
    ['roles', guild.roles.cache.size],
    ['id', guild.id],
  ]));

  const banner = guild.bannerURL({ size: 1024 });
  if (banner) picture(box, banner);

  box.addTextDisplayComponents(quiet('raw parameters. no noise.'));

  await message.reply({ ...payload(box), allowedMentions: { parse: [] } });
}
