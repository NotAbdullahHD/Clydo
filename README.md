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

all of it lives in `src/lib/theme.js`. commands never hard-code a colour or a glyph.

every reply is the same shape: the command name as the title, `section()` groups in the
description — a `›` heading with `•` data lines under it — and a short footer. `/help`,
`/ping` and every data command are built from those parts only.

## commands

| command | does |
| --- | --- |
| `/help` | reads the live registry, so it never needs editing |
| `/ping` | roundtrip + gateway latency |
| `/crypto [assets]` | spot price and 24h change, up to 5 assets, 30s cache |
| `/serverinfo` | identity and metrics for the current server |
| `/userinfo [user]` | account age and presence |
| `/purge <amount>` | clear 1–100 recent messages, manage-messages only |
| `/snipe` | the last deleted message in this channel |

`,` is the prefix. `/help` lists prefixed commands too.

| prefixed | does |
| --- | --- |
| `,sobs` | count for you, or for a mention |
| `,sobs lb` | top 10 in this server |
| `,sobs add 5 @user` | manage server |
| `,sobs enable` / `disable` | manage server |
| `,sobs ban` / `unban @user` | owner only |

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
  lib/sobs.js       json-backed sob counts, scoped per server
  commands/
    help.js         reads the live command registry
    ping.js         roundtrip + gateway latency
    crypto.js       coingecko tape
    serverinfo.js   server parameters
    userinfo.js     account + presence
    purge.js        message cleanup
    snipe.js        last deleted message
    sobs.js         prefix-only sob counts + leaderboard
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
`,sobs add` is for correcting the number by hand; the count itself comes from reactions.

prefix routing needs the privileged **message content intent** — without it
discord sends empty message content, so `,sobs` cannot see anything. that is
why `MESSAGE_INTENT=true` is required for prefix commands and not just `/snipe`.

## storage

sob counts and per-server settings live in mongo when `MONGO_URI` is set — the
database name comes from the uri path (`/clydo`), two collections (`counts`,
`guilds`) with a unique index on each key. with no uri, everything falls back to
`data/sobs.json`, so a fresh checkout still runs. an existing json file is moved
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
