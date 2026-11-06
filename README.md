# clydo

a discord bot built on raw typography. zero emojis, strict lower-case, no bright colour.

```
› roundtrip  •  42ms
› gateway    •  38ms
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

## setup

```bash
npm install
cp .env.example .env
```

then fill `.env`:

```env
DISCORD_TOKEN=your bot token
GUILD_ID=optional server id for instant command registration
```

invite the bot with the `bot` + `applications.commands` scopes, then:

```bash
npm start
```

slash commands register on boot — instantly when `GUILD_ID` is set,
otherwise globally (discord can take up to an hour to propagate).

## structure

```
src/
  index.js          client bootstrap, command loader, registration, error handling
  lib/theme.js      palette, marks, panel + datapoint helpers
  commands/
    help.js         reads the live command registry
    ping.js         roundtrip + gateway latency
assets/
  pfp.svg           pfp source
  pfp.png           ready to upload
```

## adding a command

drop a file in `src/commands/`. the loader picks up any module with a
`data` export (a `SlashCommandBuilder`) and an `execute` function.

```js
import { SlashCommandBuilder } from 'discord.js';
import { panel, datapoint } from '../lib/theme.js';

export const data = new SlashCommandBuilder()
  .setName('thing')
  .setDescription('does a thing');

export async function execute(interaction) {
  await interaction.reply({
    embeds: [panel({ title: 'thing', description: datapoint('state', 'on') })],
  });
}
```

`/help` picks it up automatically.
