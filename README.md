# clydo

a discord bot built on raw typography. zero emojis, strict lower-case, no bright colour.

```
› btc
  price          $68,432.10
  change_24h     -1.42%
```

## doctrine

| token | value | use |
| --- | --- | --- |
| panel | `#2b2d31` | every embed colour |
| recessed | `#1e1f22` | nested / secondary panels |
| void | `#000000` | pfp background |
| ink | `#ffffff` | pfp linework |

- accents are limited to `›`, `•`, `—` and `━━━━━━━━━━`
- every title, field name, footer and label is lower-case
- no emojis, no colour accents, no images inside embeds
- the flag game is the one exception: it keeps labubu's embed, its ❓ / 📊 buttons and
  plain-text results, because it is the same game people already know

all of it lives in `src/lib/theme.js`. commands never hard-code a colour or a glyph.

every reply is the same shape: the command name as the title, `section()` groups in the
description — a `›` heading with `•` data lines under it — and a short footer. `/help`,
`/ping` and every data command are built from those parts only.

## commands

| command | does |
| --- | --- |
| `/help` | the module panel — `/help <command>` for one command |
| `/ping` | roundtrip + gateway latency |

two slash commands, nothing else. everything below is prefix only, and `,help`
opens the same panel from chat.

`,` is the prefix.

| prefixed | does |
| --- | --- |
| `,sobs` | count for you, or for a mention |
| `,sobs lb` | top 10 in this server |
| `,sobs add 5 @user` | manage server |
| `,sobs enable` / `disable` | manage server |
| `,sobs ban` / `unban @user` | owner only |
| `,flag` | guess the flag — ten seconds a round |
| `,flaghint` | hint for the round running in this channel |
| `,flaglb` | flag leaderboard, ten per page |
| `,trivia [category]` | trivia round — fifteen seconds |
| `,trivialb` | trivia leaderboard, ten per page |
| `,fm` / `,fm set <user>` | last.fm now playing |
| `,google <query>` | google search, ten results per page |
| `,image <query>` | google image search |
| `,crypto [assets]` | spot price and 24h change, up to 5 assets |
| `,serverinfo` | identity and metrics for the current server |
| `,userinfo [@user]` | account age and presence |
| `,snipe` | the last deleted message in this channel |
| `,purge <1-100>` | clear recent messages |
| `,ban @user [reason]` | ban, with a DM first |
| `,kick @user [reason]` | kick, with a DM first |
| `,unban <userId> [reason]` | unban by id |
| `,timeout @user <10m\|2h\|1d> [reason]` | 5 seconds to 28 days |
| `,warn @user [reason]` | warn, with a DM |
| `,nick @user <name>` | change a nickname, omit to reset |
| `,role @user <role>` | toggle a role on a member |
| `,slowmode <0-21600>` | channel slowmode, 0 turns it off |
| `,clear <1-100>` | bulk delete, confirmation deletes itself |
| `,family marry @user` | propose — accept or decline buttons |
| `,family divorce` | end the marriage |
| `,family adopt @user` | adopt a child |
| `,family disown @user` | remove a child |
| `,family tree [user]` | partner, parent and children |
| `,marry` / `,divorce` / `,adopt` / `,disown` / `,tree` | the same five on their own |

`/crypto` takes shorthands (`btc eth sol`) or any coingecko id, and quotes coinGecko's
public endpoint — no key required.

## setup

```bash
npm install
cp .env.example .env
```

then fill `.env`:

```env
DISCORD_TOKEN=your bot token
GUILD_ID=optional server id for instant command registration
PRESENCE_INTENT=false
MESSAGE_INTENT=false
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/clydo?appName=clydo
LASTFM_API_KEY=
SERPAPI_KEY=
PREFIX=,
OWNER_ID=
```

invite the bot with the `bot` + `applications.commands` scopes, then:

```bash
npm start
```

slash commands register on boot — instantly when `GUILD_ID` is set,
otherwise globally (discord can take up to an hour to propagate).

`/userinfo` shows `presence • not shared` until you enable the **presence intent**
in the developer portal and set `PRESENCE_INTENT=true`. it is privileged and stays
off by default so the bot can always log in.

`/snipe` records who and when either way, but only reads the deleted text when the
**message content intent** is enabled and `MESSAGE_INTENT=true`. both flags are
off by default because a privileged intent the portal has not approved makes login
fail outright.

## structure

```
src/
  index.js          client bootstrap, command loader, registration, interaction routing
  lib/theme.js      palette, marks, panel / datapoint / tape helpers
  lib/errors.js     single failure path, ref codes, stay-online handlers
  lib/prefix.js     `,` message routing
  lib/reactions.js  sob emoji → author count
  lib/snipes.js     per-channel deleted message store + watcher
  lib/sobs.js       sob counts, server settings, award ledger
  lib/scores.js     score tables — add a point, page them, count players
  lib/flags.js      flag game scores
  lib/flag-list.js  country codes, names, accepted answers
  lib/trivia.js     trivia scores
  lib/trivia-questions.js  the labubu question bank
  lib/lastfm.js     one last.fm username per discord user
  lib/family.js     partner, parent and children per user
  commands/
    fun/
      sobs.js       prefix-only sob counts + leaderboard
      flag.js       prefix-only flag round
      flaghint.js   hint for the running round
      flaglb.js     flag leaderboard with pages
      trivia.js     trivia round + points
      trivialb.js   trivia leaderboard with pages
      fm.js         last.fm now playing
      google.js     google search and image search
      image.js      image search alias
      family.js     family subcommands
      marry.js      proposal flow
      divorce.js    end a marriage
      adopt.js      adopt a child
      disown.js     remove a child
      tree.js       partner and children
    moderation/
      purge.js      message cleanup
      clear.js      bulk delete
      ban.js        ban with a DM
      kick.js       kick with a DM
      unban.js      unban by id
      timeout.js    timed out members
      warn.js       warn with a DM
      nick.js       nicknames
      role.js       toggle a role
      slowmode.js   channel slowmode
    utility/
      help.js       reads the live command registry
      ping.js       roundtrip + gateway latency
      crypto.js     coingecko tape
      serverinfo.js server parameters
      userinfo.js   account + presence
      snipe.js      last deleted message
assets/
  pfp.svg           pfp source
  pfp.png           ready to upload
```

## prefix

every message command uses `,` — change it with `PREFIX`. a command opts in by
exporting a `prefix(message, args)` function next to its `data` and `execute`;
the router finds it by name and never touches slash-only commands.

```
,sobs                  count for you, or for a mention
,sobs lb               top 10 in this server
,sobs add 5 @user      manage server
,sobs enable|disable   manage server
,sobs ban @user        owner only
,sobs unban @user      owner only
```

a command can be prefix-only: `sobs` exports `name` and `prefix` with no `data`,
so nothing is registered for it as a slash command and `/help` lists it under the prefix.

sobs are earned, not given: every 😭 reaction a message collects is one sob for its
author. each reactor counts once, bots included, so five reactors is five sobs.

every credit is written to an award ledger keyed by `guild:message:reactor`, so
removing and re-adding one reaction cannot pay twice, and a second bot session
cannot credit an event it also saw. taking the reaction back returns the sob.
`,sobs add` is for correcting the number by hand; the count itself comes from reactions.

prefix routing needs the privileged **message content intent** — without it
discord sends empty message content, so `,sobs` cannot see anything. that is
why `MESSAGE_INTENT=true` is required for prefix commands and not just `/snipe`.

## storage

sob counts and per-server settings live in mongo when `MONGO_URI` is set — the
database name comes from the uri path (`/clydo`), seven collections (`counts`, `guilds`, `awards`, `flags`, `trivia`, `lastfm`,
`family`) with a unique index on each key, plus a 30-day ttl that trims the award
ledger. with no uri, everything falls back to `data/*.json` — sobs, flags, trivia,
lastfm and family — so a fresh checkout still runs. an existing json file is moved
into an empty database once and then renamed `.migrated`.

## snipes and sobs

both are memory-shaped features with one exception: sob counts are written to
`data/sobs.json` so a restart doesn't wipe the leaderboard. the file is gitignored
and created on the first sob. snipes stay in memory and clear on restart.

every failure goes through `failInteraction()`: one console entry with a ref code,
one ephemeral panel carrying the same code, and the right reply method whichever
state the interaction is in (fresh / deferred / already replied). command files
do not catch — the router does it for them.

`holdOnline()` keeps the process up through an escaped rejection or exception and
logs loudly, since nothing restarts it automatically.

## adding a command

drop a file in `src/commands/`. the loader picks up any module with a
`data` export (a `SlashCommandBuilder`) and an `execute` function.

```js
import { SlashCommandBuilder } from 'discord.js';
import { panel, tape } from '../lib/theme.js';

export const data = new SlashCommandBuilder()
  .setName('thing')
  .setDescription('does a thing');

export async function execute(interaction) {
  await interaction.reply({
    embeds: [panel({ title: 'thing', description: tape([{ rows: [['state', 'on']] }]) })],
  });
}
```

`/help` picks it up automatically.
