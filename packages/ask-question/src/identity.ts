export interface Student {
  id: string;
  name: string;
  savedAt: number;
}

const STORAGE_KEY = 'askq.student.v1';
const CHANNEL_NAME = 'askq.identity';

export function randomId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for older browsers and for jsdom without webcrypto.
  const hex = (n: number) =>
    Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  return `${hex(8)}-${hex(4)}-4${hex(3)}-a${hex(3)}-${hex(12)}`;
}

function readStorage(): Student | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Student>;
    if (!parsed || typeof parsed.id !== 'string' || typeof parsed.name !== 'string') return null;
    return { id: parsed.id, name: parsed.name, savedAt: parsed.savedAt ?? 0 };
  } catch {
    return null;
  }
}

let current: Student | null = readStorage();
let loaded = typeof localStorage !== 'undefined';
const listeners = new Set<(student: Student | null) => void>();

function emit(): void {
  for (const listener of [...listeners]) listener(current);
}

let channel: BroadcastChannel | null = null;
function ensureChannel(): BroadcastChannel | null {
  if (channel || typeof BroadcastChannel === 'undefined') return channel;
  channel = new BroadcastChannel(CHANNEL_NAME);
  channel.onmessage = () => {
    current = readStorage();
    emit();
  };
  return channel;
}

if (typeof window !== 'undefined') {
  // Another tab wrote the key.
  window.addEventListener('storage', (event) => {
    if (event.key !== null && event.key !== STORAGE_KEY) return;
    current = readStorage();
    emit();
  });
  ensureChannel();
}

function persist(student: Student | null): void {
  if (typeof localStorage === 'undefined') return;
  try {
    if (student) localStorage.setItem(STORAGE_KEY, JSON.stringify(student));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Private mode or blocked storage: identity simply won't survive a reload.
  }
}

export function getStudent(): Student | null {
  if (!loaded && typeof localStorage !== 'undefined') {
    current = readStorage();
    loaded = true;
  }
  return current;
}

/** True once localStorage has been consulted — used to avoid a hydration flash. */
export function isIdentityLoaded(): boolean {
  return loaded;
}

export function normaliseName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

/** Case- and whitespace-insensitive key used to group a student's attempts. */
export function nameKey(name: string): string {
  return normaliseName(name).toLowerCase();
}

export const MIN_NAME_LENGTH = 2;
export const MAX_NAME_LENGTH = 60;

/** Mints a new student id. Signing in again after a logout is a NEW id by design. */
export function signIn(rawName: string): Student {
  const name = normaliseName(rawName).slice(0, MAX_NAME_LENGTH);
  if (name.length < MIN_NAME_LENGTH) {
    throw new Error(`Please enter at least ${MIN_NAME_LENGTH} characters.`);
  }
  const student: Student = { id: randomId(), name, savedAt: Date.now() };
  current = student;
  loaded = true;
  persist(student);
  emit();
  ensureChannel()?.postMessage({ type: 'identity' });
  return student;
}

export function signOut(): void {
  current = null;
  loaded = true;
  persist(null);
  emit();
  ensureChannel()?.postMessage({ type: 'identity' });
}

export function subscribeToIdentity(listener: (student: Student | null) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Test helper. */
export function resetIdentity(): void {
  current = null;
  loaded = typeof localStorage !== 'undefined';
  persist(null);
  emit();
}
