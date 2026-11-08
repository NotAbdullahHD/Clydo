/**
 * the mobile badge.
 *
 * discord decides the phone icon from the properties the client declares when
 * it opens a gateway session — there is no presence field for it, and discord.js
 * no longer takes properties as an option. the one supported hook is `ws.
 * buildStrategy`, which runs after the gateway manager has its options and
 * before any shard connects, so the properties can be set exactly once, there.
 *
 * it is cosmetic: the bot still connects as a bot, and the badge only changes
 * what discord draws next to the status dot. `MOBILE_STATUS=off` leaves the
 * library defaults alone.
 */

const profiles = {
  ios: { os: 'iOS', browser: 'Discord iOS', device: 'iPhone' },
  android: { os: 'Android', browser: 'Discord Android', device: 'Android' },
};

/** `ios` when unset, null when switched off, ios for anything unrecognised. */
export function choice(value) {
  const wanted = String(value ?? '').trim().toLowerCase();

  if (!wanted) return 'ios';
  if (['off', 'no', 'none', 'false'].includes(wanted)) return null;

  return profiles[wanted] ? wanted : 'ios';
}

/** `{ status, ws }` — status for the boot log, ws for the client options. */
export async function options(value) {
  const platform = choice(value);
  if (!platform) return { status: null, ws: null };

  const properties = { ...profiles[platform] };

  try {
    const { DefaultWebSocketManagerOptions } = await import('@discordjs/ws');

    if (typeof DefaultWebSocketManagerOptions?.buildStrategy !== 'function') {
      throw new Error('this @discordjs/ws build has no buildStrategy');
    }

    return {
      status: { platform, properties },
      ws: {
        buildStrategy: (manager) => {
          manager.options.identifyProperties = { ...properties };

          return DefaultWebSocketManagerOptions.buildStrategy(manager);
        },
      },
    };
  } catch (error) {
    return { status: { platform, error: error.message }, ws: null };
  }
}
