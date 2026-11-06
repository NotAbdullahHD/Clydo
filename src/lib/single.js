import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

/**
 * one gateway session per machine.
 *
 * two copies logged in at once both receive every message, so every command is
 * answered twice and every reaction counts twice. the lock is a pid file: a
 * stale pid from a crashed run is ignored because the process behind it is gone.
 *
 * deliberately synchronous — this runs once at boot, and an async read left a
 * libuv handle open, which made the refusal path die on an assertion instead of
 * exiting quietly.
 */

const file = path.join(process.cwd(), '.clydo.pid');

const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

/** returns the pid already running, or null once this process owns the lock. */
export function claim() {
  try {
    const pid = Number(readFileSync(file, 'utf8').trim());
    if (pid && pid !== process.pid && alive(pid)) return pid;
  } catch {
    // no lock file, or unreadable — claim it.
  }

  writeFileSync(file, String(process.pid));
  return null;
}

export function release() {
  try {
    rmSync(file, { force: true });
  } catch {
    // nothing to clean up.
  }
}
