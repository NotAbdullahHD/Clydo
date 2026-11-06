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
data answers use `tape()` — grouped, column-aligned rows inside a monospace block.

## commands

| command | does |
| --- | --- |
| `/help` | reads the live registry, so it never needs editing |
| `/ping` | roundtrip + gateway latency |
| `/crypto [assets]` | spot price and 24h change, up to 5 assets, 30s cache |
| `/serverinfo` | identity and metrics for the current server |
| `/userinfo [user]` | account age and presence |
| `/purge <amount>` | clear 1–100 recent messages, manage-messages only |

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

## structure

```
src/
  index.js          client bootstrap, command loader, registration, interaction routing
  lib/theme.js      palette, marks, panel / datapoint / tape helpers
  lib/errors.js     single failure path, ref codes, stay-online handlers
  commands/
    help.js         reads the live command registry
    ping.js         roundtrip + gateway latency
    crypto.js       coingecko tape
    serverinfo.js   server parameters
    userinfo.js     account + presence
    purge.js        message cleanup
assets/
  pfp.svg           pfp source
  pfp.png           ready to upload
```

## errors

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
