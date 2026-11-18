import 'dotenv/config';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  Client,
  Collection,
  Events,
  GatewayIntentBits,
  MessageFlags,
  Partials,
  REST,
  Routes,
} from 'discord.js';
import { watch as watchHoneypot } from './lib/honeypot.js';
import { watch as watchPoj } from './lib/poj.js';
import { watch as watchSticky } from './lib/sticky.js';
import { watch as watchLevels } from './lib/levels.js';
import { watch as watchVoice } from './lib/activity.js';
import { watch as watchVoicemaster } from './lib/voicemaster.js';
import { watch as watchVanity } from './lib/vanity.js';
import { watch as watchResponders } from './lib/autoresponder.js';
import { watch as watchJail } from './lib/jail.js';
import { watch as watchAntinuke } from './lib/antinuke.js';
import { watch as watchAfk } from './lib/afk.js';
import { failInteraction, holdOnline, report } from './lib/errors.js';
import { prefix, route as routePrefix } from './lib/prefix.js';
import { watch as watchSobReactions } from './lib/reactions.js';
import { open as openStore } from './lib/sqlite.js';
import { migrate as migrateJson } from './lib/import-json.js';
import { handleSearch } from './lib/browser.js';
import { claim, release } from './lib/single.js';
import { rotate, watch as watchPresence } from './lib/presence.js';
import { options as mobileOptions } from './lib/mobile.js';
import { validate as validateEmoji } from './lib/emoji.js';
import { watch as watchSnipes } from './lib/snipes.js';
import { watch as watchAutomod } from './lib/automod.js';
import { watch as watchLogging } from './lib/logging.js';
import { watch as watchRoles } from './lib/roles.js';
import { watch as watchStarboard } from './lib/starboard.js';
import { watch as watchTickets } from './lib/tickets.js';
import { watch as watchWelcome } from './lib/welcome.js';
import { panel } from './lib/theme.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const commandDir = path.join(here, 'commands');

const token = process.env.DISCORD_TOKEN?.trim();
const guildId = process.env.GUILD_ID?.trim();
const overrides = {
  presence: process.env.PRESENCE_INTENT?.trim().toLowerCase(),
  messageContent: process.env.MESSAGE_INTENT?.trim().toLowerCase(),
  members: process.env.MEMBERS_INTENT?.trim().toLowerCase(),
};

const log = (...args) => console.log('[slink]', ...args);

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
  members: (1 << 14) | (1 << 15),
  messageContent: (1 << 18) | (1 << 19),
};

async function portalIntents() {
  /**
   * the portal read is the first thing boot does, so a dead network used to
   * hang the process before it could log a single line. five seconds, then
   * fall back to the env overrides like any other unreadable portal.
   */
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5_000);

  try {
    // raw fetch rather than REST: only this call needs an abort signal, and a
    // hung portal must not hold boot open.
    const response = await fetch('https://discord.com/api/v10/applications/@me', {
      headers: { Authorization: `Bot ${token}` },
      signal: controller.signal,
    });

    if (!response.ok) throw new Error(`portal answered ${response.status}`);

    const application = await response.json();
    const flags = application?.flags ?? 0;

    return {
      presence: Boolean(flags & bits.presence),
      members: Boolean(flags & bits.members),
      messageContent: Boolean(flags & bits.messageContent),
    };
  } catch (error) {
    report('reading portal intents', error);
    return { presence: false, members: false, messageContent: false };
  } finally {
    clearTimeout(timer);
  }
}

const resolve = (override, detected) => {
  if (override === 'true') return true;
  if (override === 'false') return false;
  return detected;
};

const portal = await portalIntents();
const presenceIntent = resolve(overrides.presence, portal.presence);
const membersIntent = resolve(overrides.members, portal.members);
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

// sqlite is the store now. json files from the mongo era are lifted in once,
// then parked as *.migrated so a restart cannot import them over live data.
openStore();
log('store: data/slink.db (sqlite).');

const imported = await migrateJson(log);
if (imported) log(`imported ${imported} row(s) from data/*.json.`);

/**
 * guilds + guild messages is all a slash-command bot needs. a privileged intent
 * is only requested when the portal has it on, because asking for an unapproved
 * one fails the login outright.
 */
const intents = [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildMessages,
  GatewayIntentBits.GuildMessageReactions,
  // voice state is not privileged — the voice log is free once it is asked for.
  GatewayIntentBits.GuildVoiceStates,
  // antinuke reads the audit log; the intent is standard, not privileged.
  GatewayIntentBits.GuildModeration,
];
if (presenceIntent) intents.push(GatewayIntentBits.GuildPresences);
if (membersIntent) intents.push(GatewayIntentBits.GuildMembers);
if (messageIntent) intents.push(GatewayIntentBits.MessageContent);

// the badge is an identify property, so it is set inside the strategy hook,
// before the first shard opens a session.
const mobile = await mobileOptions(process.env.MOBILE_STATUS);

const client = new Client({
  intents,
  ...(mobile.ws ? { ws: mobile.ws } : {}),
  /** reactions on old messages arrive partial, so they need fetching. */
  partials: [Partials.Message, Partials.Reaction, Partials.Channel],
});
client.commands = new Collection();
/** command name → its folder, so /help can group them into modules. */
client.categories = new Map();
/** docstrings, so prefix-only commands can describe themselves and show usage. */
client.about = new Map();
client.usage = new Map();
watchSnipes(client);
watchHoneypot(client);
watchAfk(client, log);
watchPresence(client);
routePrefix(client);
watchSobReactions(client);
watchLogging(client);
watchWelcome(client);
watchPoj(client);
watchSticky(client);
watchLevels(client);
watchVoice(client);
watchVoicemaster(client);
watchVanity(client, log);
watchResponders(client);
watchJail(client);
watchAntinuke(client);
watchRoles(client);
watchStarboard(client);
watchAutomod(client);
watchTickets(client);

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

      const source = await readFile(file, 'utf8').catch(() => '');
      const doc = source.match(/\/\*\*\s*`([^`]+)`\s*(?:—|-)\s*([^*]+?)\s*\*\//);

      if (doc) {
        client.usage.set(name, doc[1].trim());
        client.about.set(name, doc[2].replace(/\s+/g, ' ').trim());
      }

      client.commands.set(name, module);
      client.categories.set(
        name,
        path.relative(commandDir, path.dirname(file)).split(path.sep)[0] || 'core',
      );
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

client.once(Events.ClientReady, async (ready) => {
  log(`online as ${ready.user.tag}.`);
  await validateEmoji(client, log);
  log('counts: data/slink.db.');
  log(presenceIntent ? 'presence intent: on.' : 'presence intent: off.');
  log(membersIntent ? 'members intent: on.' : 'members intent: off — welcome, autoroles and member logs wait for it.');
  log(messageIntent ? 'message content intent: on.' : 'message content intent: off.');
  log(mobile.status?.error
    ? `mobile status: ${mobile.status.platform} requested but the gateway could not be patched — ${mobile.status.error}.`
    : mobile.status
      ? `mobile status: ${mobile.status.platform} (${mobile.status.properties.os} · ${mobile.status.properties.browser}).`
      : 'mobile status: off.');
  log(`prefix: ${prefix}`);

  if (!messageIntent) {
    log(`prefix commands like ${prefix}sobs are inert until MESSAGE_INTENT=true.`);
  }

  if (presenceIntent) log('vanity tracker: on.');
  else log('vanity tracker: dormant — the presence intent is off.');

  log(`status: ${rotate(client, log)}.`);

  try {
    await registerCommands();
  } catch (error) {
    report('registering commands', error);
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isModalSubmit()) {
    await handleSearch(interaction, client);
    return;
  }

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
