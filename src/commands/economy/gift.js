import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageFlags } from 'discord.js';
import { amount, bad, coin, get, short, update } from '../../lib/economy.js';
import { tier } from '../../lib/emoji.js';
import { palette } from '../../lib/theme.js';

/**
 * `,gift <amount>` — orbs in a box; the first person to open it takes them.
 *
 * nothing is held up front. the orbs stay in the giver's wallet until someone
 * clicks, so an unopened box simply expires and there is no refund job to run
 * and no pending row to reconcile after a restart.
 */

export const name = 'gift';

const window = 60_000;

const line = (accent, text) => new EmbedBuilder().setColor(accent).setDescription(text);

export async function prefix(message, args) {
  const tag = `<@${message.author.id}>`;
  const record = await get(message.author.id);
  const value = amount(
    args.find((arg) => /^[\d,_]+$/.test(arg) || arg.toLowerCase() === 'all'),
    record.wallet,
  );
  const reply = (embed) => message.reply({ embeds: [embed], allowedMentions: { parse: [] } });

  if (!value) {
    await reply(bad(record.wallet === 0
      ? `${tag}: your wallet is empty.`
      : `${tag}: usage — \`,gift <amount>\``));
    return;
  }

  if (value > record.wallet) {
    await reply(bad(`${tag}: you only have ${coin} ${short(record.wallet)} on you.`));
    return;
  }

  const box = tier(value);
  const sent = await message.reply({
    embeds: [
      line(palette.panel, `${box} ${tag} left ${coin} ${short(value)} in a box.\n-# first to open takes it · one minute`),
    ],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`gift:${message.author.id}:${value}`)
          .setLabel('open')
          .setStyle(ButtonStyle.Success),
      ),
    ],
    allowedMentions: { parse: [] },
  });

  const collector = sent.createMessageComponentCollector({ time: window });
  let claimed = false;

  collector.on('collect', async (press) => {
    if (claimed) {
      await press
        .reply({ embeds: [bad('someone got there first.')], flags: MessageFlags.Ephemeral })
        .catch(() => {});
      return;
    }

    if (press.user.id === message.author.id) {
      await press
        .reply({ embeds: [bad('that is your own box — someone else has to open it.')], flags: MessageFlags.Ephemeral })
        .catch(() => {});
      return;
    }

    /* take the claim before the first await, so two fast clicks cannot both win. */
    claimed = true;

    const giver = await get(message.author.id);

    if (giver.wallet < value) {
      claimed = false;
      collector.stop('empty');

      await press
        .reply({ embeds: [bad('the box is empty — those orbs were spent before anyone opened it.')], flags: MessageFlags.Ephemeral })
        .catch(() => {});
      return;
    }

    await update(message.author.id, (row) => {
      row.wallet -= value;
      return row;
    }, message.author.username);

    await update(press.user.id, (row) => {
      row.wallet += value;
      return row;
    }, press.user.username);

    collector.stop('opened');

    await press
      .update({
        embeds: [
          line(palette.good, `${box} ${tag}'s ${coin} ${short(value)} was opened by <@${press.user.id}>.\n-# gift delivered`),
        ],
        components: [],
      })
      .catch(() => {});
  });

  collector.on('end', async (_, reason) => {
    if (reason === 'opened' || reason === 'empty') return;

    await sent
      .edit({
        embeds: [
          line(palette.panel, `${box} ${tag}'s ${coin} ${short(value)} was never opened.\n-# nothing moved — the orbs are still in your wallet`),
        ],
        components: [],
      })
      .catch(() => {});
  });
}
