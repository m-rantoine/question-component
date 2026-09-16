import { describe, expect, it } from 'vitest';
import { configure, getConfig } from '../src/runtime';
import { getTransport } from '../src/transport';

describe('readEndpoint', () => {
  it('has no default, so the package never guesses a consuming app URL', () => {
    expect(getConfig().readEndpoint).toBeUndefined();
  });

  it('is required once Supabase is configured, and says so', () => {
    configure({ supabaseUrl: 'https://example.supabase.co', supabaseAnonKey: 'anon' });
    // A silent fetch to a guessed path would look like "nobody answered".
    expect(() => getTransport()).toThrow(/readEndpoint/);
  });

  it('is not needed while answers are kept in memory', () => {
    // No credentials: the memory transport needs no route, so a fresh clone
    // still runs before any setup.
    expect(() => getTransport()).not.toThrow();
  });
});
