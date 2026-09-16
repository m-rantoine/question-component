import { configure } from '@askq/react';
import { READ_ENDPOINT } from './dashboard-links';

// Importing the bank registers every question, which is what lets an island
// resolve a question from its id string.
import '../questions';

/**
 * Configuration lives on a `globalThis`-pinned runtime, so this runs once per
 * page no matter how many islands import it, and every island sees the same
 * settings and the same poller.
 */
configure({
  supabaseUrl: import.meta.env.PUBLIC_SUPABASE_URL,
  supabaseAnonKey: import.meta.env.PUBLIC_SUPABASE_ANON_KEY,
  readEndpoint: READ_ENDPOINT,
  pollMs: 5000,
  idleMs: 60_000,
  maxSessionMs: 30 * 60_000,
});
