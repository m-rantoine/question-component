import { runtime } from './runtime';

/**
 * Decides when result polling should stop.
 *
 * Mouse movement alone is the wrong signal: a teacher watching the projector
 * never moves the mouse, and touch devices never fire `mousemove` at all. So
 * activity is any of pointer, keyboard, touch, scroll or focus, tab visibility
 * pauses immediately, and a hard session cap stops a page left open overnight.
 */
const ACTIVITY_EVENTS = [
  'pointermove',
  'pointerdown',
  'keydown',
  'touchstart',
  'scroll',
  'focus',
] as const;

const CHECK_INTERVAL_MS = 1000;

function emit(): void {
  runtime.idle.version += 1;
  for (const listener of [...runtime.idle.listeners]) listener();
}

function setPaused(paused: boolean, reason: IdleReason | null): void {
  const idle = runtime.idle;
  if (idle.paused === paused && idle.reason === reason) return;
  idle.paused = paused;
  idle.reason = reason;
  emit();
}

export type IdleReason = 'idle' | 'hidden' | 'session-limit';

function noteActivity(): void {
  // Deliberately does NOT un-pause. Once polling has stopped for inactivity it
  // stays stopped until the banner's button is pressed, so a page left open on
  // a projector cannot quietly resume because someone brushed the desk.
  runtime.idle.lastActivityAt = Date.now();
}

function tick(): void {
  const idle = runtime.idle;
  const now = Date.now();
  const config = runtime.config;
  const hidden = typeof document !== 'undefined' && document.hidden;

  if (idle.paused) {
    // A background-tab pause clears itself when the tab comes back. An idle or
    // session-limit pause does not: those need `resumePolling()`, and a hidden
    // tab must not become a way around that.
    if (idle.reason === 'hidden' && !hidden) {
      idle.lastActivityAt = now;
      setPaused(false, null);
    }
    return;
  }

  if (hidden) {
    setPaused(true, 'hidden');
    return;
  }
  if (now - idle.sessionStartedAt >= config.maxSessionMs) {
    setPaused(true, 'session-limit');
    return;
  }
  if (now - idle.lastActivityAt >= config.idleMs) {
    setPaused(true, 'idle');
  }
}

export function installIdleWatcher(): void {
  if (runtime.idle.installed || typeof window === 'undefined') return;
  runtime.idle.installed = true;
  runtime.idle.lastActivityAt = Date.now();
  runtime.idle.sessionStartedAt = Date.now();

  for (const event of ACTIVITY_EVENTS) {
    window.addEventListener(event, noteActivity, { passive: true, capture: true });
  }
  document.addEventListener('visibilitychange', tick);
  runtime.idle.timer = setInterval(tick, CHECK_INTERVAL_MS);
}

export function isPollingPaused(): boolean {
  return runtime.idle.paused;
}

export function getIdleReason(): IdleReason | null {
  return runtime.idle.reason;
}

/** Called by the "resume" button in the paused banner. */
export function resumePolling(): void {
  const idle = runtime.idle;
  idle.lastActivityAt = Date.now();
  idle.sessionStartedAt = Date.now();
  setPaused(false, null);
}

export function subscribeToIdle(listener: () => void): () => void {
  runtime.idle.listeners.add(listener);
  installIdleWatcher();
  return () => {
    runtime.idle.listeners.delete(listener);
  };
}

export function getIdleVersion(): number {
  return runtime.idle.version;
}
