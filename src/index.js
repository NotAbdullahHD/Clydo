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
import { panel } from './lib/theme.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const commandDir = path.join(here, 'commands');

const token = process.env.DISCORD_TOKEN?.trim();
const guildId = process.env.GUILD_ID?.trim();

const log = (...args) => console.log('[clydo]', ...args);

if (!token) {
  log('no token found.');
  log('copy .env.example to .env and set DISCORD_TOKEN.');
  process.exit(1);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.commands = new Collection();

async function loadCommands() {
  const files = (await readdir(commandDir)).filter((file) => file.endsWith('.js')).sort();

  for (const file of files) {
    const module = await import(pathToFileURL(path.join(commandDir, file)).href);

    if (!module.data || typeof module.execute !== 'function') {
      log(`skipped ${file} — needs "data" and "execute" exports.`);
      continue;
    }

    client.commands.set(module.data.name, module);
  }

  log(`loaded ${client.commands.size} command(s).`);
}

async function registerCommands() {
  const body = [...client.commands.values()].map((command) => command.data.toJSON());
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

  ready.user.setPresence({
    status: 'online',
    activities: [{ name: '/help', type: ActivityType.Watching }],
  });

  try {
    await registerCommands();
  } catch (error) {
    log('command registration failed.');
    console.error(error);
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction, client);
  } catch (error) {
    console.error(error);

    const payload = {
      embeds: [panel({ title: 'error', description: 'that one broke. try again in a moment.' })],
      flags: MessageFlags.Ephemeral,
    };

    if (interaction.deferred || interaction.replied) {
      await interaction.followUp(payload).catch(() => {});
      return;
    }

    await interaction.reply(payload).catch(() => {});
  }
});

process.on('unhandledRejection', (error) => {
  log('unhandled rejection.');
  console.error(error);
});

await loadCommands();
await client.login(token);
