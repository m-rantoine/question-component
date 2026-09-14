import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installIdleWatcher, isPollingPaused, resumePolling } from '../src/idle';
import { configure } from '../src/runtime';

describe('idle watching', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    configure({ idleMs: 1000, maxSessionMs: 10_000 });
    installIdleWatcher();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('pauses polling once the idle window passes', () => {
    expect(isPollingPaused()).toBe(false);
    vi.advanceTimersByTime(1500);
    expect(isPollingPaused()).toBe(true);
  });

  it('stays paused when the user moves the mouse — only the button resumes', () => {
    vi.advanceTimersByTime(1500);
    expect(isPollingPaused()).toBe(true);

    window.dispatchEvent(new Event('pointermove'));
    vi.advanceTimersByTime(200);
    expect(isPollingPaused()).toBe(true);

    resumePolling();
    expect(isPollingPaused()).toBe(false);
  });

  it('stops at the hard session cap even while the user is active', () => {
    for (let elapsed = 0; elapsed < 11_000; elapsed += 500) {
      window.dispatchEvent(new Event('pointermove'));
      vi.advanceTimersByTime(500);
    }
    expect(isPollingPaused()).toBe(true);
  });
});
