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
  Partials,
  REST,
  Routes,
} from 'discord.js';
import { failInteraction, holdOnline, report } from './lib/errors.js';
import { prefix, route as routePrefix } from './lib/prefix.js';
import { watch as watchSobReactions } from './lib/reactions.js';
import { connect } from './lib/db.js';
import { claim, release } from './lib/single.js';
import { watch as watchSnipes } from './lib/snipes.js';
import { migrateFromJson } from './lib/sobs.js';
import { panel } from './lib/theme.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const commandDir = path.join(here, 'commands');

const token = process.env.DISCORD_TOKEN?.trim();
const guildId = process.env.GUILD_ID?.trim();
const overrides = {
  presence: process.env.PRESENCE_INTENT?.trim().toLowerCase(),
  messageContent: process.env.MESSAGE_INTENT?.trim().toLowerCase(),
};

const log = (...args) => console.log('[clydo]', ...args);

if (!token) {
  log('no token found.');
  log('copy .env.example to .env and set DISCORD_TOKEN.');
  process.exit(1);
}

/**
 * portal flags. each intent has a normal bit and a "limited" bit set while the
 * bot is under 100 servers — either one means the toggle is on. reading these
 * beats trusting a hand-set env var, which is how this got wrong once already.
 */
const bits = {
  presence: (1 << 12) | (1 << 13),
  messageContent: (1 << 18) | (1 << 19),
};

async function portalIntents() {
  try {
    const application = await new REST().setToken(token).get('/applications/@me');
    const flags = application?.flags ?? 0;

    return {
      presence: Boolean(flags & bits.presence),
      messageContent: Boolean(flags & bits.messageContent),
    };
  } catch (error) {
    report('reading portal intents', error);
    return { presence: false, messageContent: false };
  }
}

const resolve = (override, detected) => {
  if (override === 'true') return true;
  if (override === 'false') return false;
  return detected;
};

const portal = await portalIntents();
const presenceIntent = resolve(overrides.presence, portal.presence);
const messageIntent = resolve(overrides.messageContent, portal.messageContent);

const holder = claim();

if (holder) {
  log(`another instance is already online (pid ${holder}) — exiting.`);
  // stop here rather than carrying on as a second session; waiting one tick
  // lets the log flush, because exiting mid-write trips a libuv assertion on
  // windows that prints right after the reason we just logged.
  await new Promise((resolve) => setTimeout(resolve, 250));
  process.exit(1);
}

process.on('exit', release);

const mongo = await connect(process.env.MONGO_URI?.trim(), 'clydo', log);

if (mongo) {
  const migrated = await migrateFromJson();
  if (migrated) log(`migrated ${migrated} sob count(s) into mongo.`);
}

/**
 * guilds + guild messages is all a slash-command bot needs. a privileged intent
 * is only requested when the portal has it on, because asking for an unapproved
 * one fails the login outright.
 */
const intents = [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildMessages,
  GatewayIntentBits.GuildMessageReactions,
];
if (presenceIntent) intents.push(GatewayIntentBits.GuildPresences);
if (messageIntent) intents.push(GatewayIntentBits.MessageContent);

const client = new Client({
  intents,
  /** reactions on old messages arrive partial, so they need fetching. */
  partials: [Partials.Message, Partials.Reaction, Partials.Channel],
});
client.commands = new Collection();
watchSnipes(client);
routePrefix(client);
watchSobReactions(client);

/** commands live in category folders — fun, moderation, utility — so walk them. */
async function collect(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) files.push(...(await collect(full)));
    else if (entry.name.endsWith('.js')) files.push(full);
  }

  return files.sort();
}

async function loadCommands() {
  const files = await collect(commandDir);

  for (const file of files) {
    try {
      const module = await import(pathToFileURL(file).href);

      const name = module.data?.name ?? module.name;
      const slashable = Boolean(module.data) && typeof module.execute === 'function';
      const prefixable = typeof module.prefix === 'function';

      if (!name || (!slashable && !prefixable)) {
        log(`skipped ${path.basename(file)} — needs "data"+"execute", "prefix", or both.`);
        continue;
      }

      client.commands.set(name, module);
    } catch (error) {
      report(`loading ${path.basename(file)}`, error);
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

/** watching — live member total across every server the bot sits in. */
function refreshPresence(target) {
  const users = target.guilds.cache.reduce((sum, guild) => sum + (guild.memberCount ?? 0), 0);
  const servers = target.guilds.cache.size;

  const name = `${users} users! in ${servers} servers`;

  target.user.setPresence({
    status: 'online',
    activities: [{ name, type: ActivityType.Watching }],
  });

  return name;
}

client.once(Events.ClientReady, async (ready) => {
  log(`online as ${ready.user.tag}.`);
  log(mongo ? 'counts: mongo.' : 'counts: data/sobs.json.');
  log(presenceIntent ? 'presence intent: on.' : 'presence intent: off.');
  log(messageIntent ? 'message content intent: on.' : 'message content intent: off.');
  log(`prefix: ${prefix}`);

  if (!messageIntent) {
    log(`prefix commands like ${prefix}sobs are inert until MESSAGE_INTENT=true.`);
  }

  log(`status: watching ${refreshPresence(ready)}.`);
  setInterval(() => refreshPresence(client), 10 * 60 * 1000);

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

client.on(Events.GuildCreate, () => refreshPresence(client));
client.on(Events.GuildDelete, () => refreshPresence(client));

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
