import 'dotenv/config';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  ActivityType,
  Client,
  Collection,
  Events,
  GatewayIntentBits,
  MessageFlags,
  REST,
  Routes,
} from 'discord.js';
import { failInteraction, holdOnline, report } from './lib/errors.js';
import { prefix, route as routePrefix } from './lib/prefix.js';
import { watch as watchSnipes } from './lib/snipes.js';
import { panel } from './lib/theme.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const commandDir = path.join(here, 'commands');

const token = process.env.DISCORD_TOKEN?.trim();
const guildId = process.env.GUILD_ID?.trim();
const presenceIntent = process.env.PRESENCE_INTENT?.trim() === 'true';
const messageIntent = process.env.MESSAGE_INTENT?.trim() === 'true';

const log = (...args) => console.log('[clydo]', ...args);

if (!token) {
  log('no token found.');
  log('copy .env.example to .env and set DISCORD_TOKEN.');
  process.exit(1);
}

/**
 * guilds is all a slash-command bot needs. presence is privileged: it has to be
 * toggled in the developer portal first, so it stays opt-in.
 */
const intents = [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages];
if (presenceIntent) intents.push(GatewayIntentBits.GuildPresences);
if (messageIntent) intents.push(GatewayIntentBits.MessageContent);

const client = new Client({ intents });
client.commands = new Collection();
watchSnipes(client);
routePrefix(client);

async function loadCommands() {
  const files = (await readdir(commandDir)).filter((file) => file.endsWith('.js')).sort();

  for (const file of files) {
    try {
      const module = await import(pathToFileURL(path.join(commandDir, file)).href);

      const name = module.data?.name ?? module.name;
      const slashable = Boolean(module.data) && typeof module.execute === 'function';
      const prefixable = typeof module.prefix === 'function';

      if (!name || (!slashable && !prefixable)) {
        log(`skipped ${file} — needs "data"+"execute", "prefix", or both.`);
        continue;
      }

      client.commands.set(name, module);
    } catch (error) {
      report(`loading ${file}`, error);
    }
  }

  const slash = [...client.commands.values()].filter((command) => command.data);
  log(`loaded ${client.commands.size} command(s) — ${slash.length} slash, ${client.commands.size - slash.length} prefix only.`);
}

async function registerCommands() {
  const body = [...client.commands.values()]
    .filter((command) => command.data)
    .map((command) => command.data.toJSON());
  const rest = new REST().setToken(token);

  if (guildId) {
    await rest.put(Routes.applicationGuildCommands(client.user.id, guildId), { body });
    log(`registered ${body.length} command(s) in guild ${guildId}.`);
    return;
  }

  await rest.put(Routes.applicationCommands(client.user.id), { body });
  log(`registered ${body.length} command(s) globally.`);
}

client.once(Events.ClientReady, async (ready) => {
  log(`online as ${ready.user.tag}.`);
  log(presenceIntent ? 'presence intent: on.' : 'presence intent: off.');
  log(messageIntent ? 'message content intent: on.' : 'message content intent: off.');
  log(`prefix: ${prefix}`);

  if (!messageIntent) {
    log(`prefix commands like ${prefix}sobs are inert until MESSAGE_INTENT=true.`);
  }

  ready.user.setPresence({
    status: 'online',
    activities: [{ name: '/help', type: ActivityType.Watching }],
  });

  try {
    await registerCommands();
  } catch (error) {
    report('registering commands', error);
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);

  if (!command || typeof command.execute !== 'function') {
    await interaction
      .reply({
        embeds: [panel({ title: 'unknown', description: '`›` that command is gone. run /help.' })],
        flags: MessageFlags.Ephemeral,
      })
      .catch(() => {});
    return;
  }

  try {
    await command.execute(interaction, client);
  } catch (error) {
    await failInteraction(interaction, error, `/${interaction.commandName}`);
  }
});

client.on(Events.Error, (error) => report('gateway', error));
client.on(Events.Warn, (message) => log('warn —', message));

holdOnline(log);

await loadCommands();

try {
  await client.login(token);
} catch (error) {
  report('login', error);
  log('check that DISCORD_TOKEN is current and any requested intents are enabled.');

  if (String(error?.message ?? '').toLowerCase().includes('intent')) {
    log('an intent is privileged — enable it in the portal, then set PRESENCE_INTENT / MESSAGE_INTENT.');
  }

  process.exit(1);
}
