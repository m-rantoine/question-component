/**
 * Interface translations.
 *
 * Messages are a typed object rather than string keys, so a missing or renamed
 * message is a compile error instead of a blank label in front of a class.
 *
 * This covers the *interface* only. Question text, options and correct answers
 * come from the question bank and are shown as written — see the README for why
 * localising option text would break stored answers.
 */

import { globalState } from './globalState';

export type Locale = 'fr' | 'en';

export const LOCALES: readonly Locale[] = ['fr', 'en'];

/** French is the default. A browser set to English still starts in French. */
export const DEFAULT_LOCALE: Locale = 'fr';

export const LOCALE_NAMES: Record<Locale, string> = {
  fr: 'Français',
  en: 'English',
};

/** BCP 47 tags, used for number and time formatting. */
export const LOCALE_TAGS: Record<Locale, string> = {
  fr: 'fr-CA',
  en: 'en-CA',
};

export interface Messages {
  // Asking
  submit: string;
  submitting: string;
  tryAgain: string;
  answerSubmitted: string;
  correctVerdict: string;
  incorrectVerdict: string;
  revealAnswerLabel: string;
  alreadyAnswered: string;
  savedOffline: string;
  chooseAnswerFirst: string;
  minLength: (n: number) => string;
  enterNumber: string;
  attemptCount: (n: number) => string;

  // Identity
  namePrompt: string;
  namePlaceholder: string;
  continueLabel: string;
  nameTooShort: (n: number) => string;
  logOut: string;
  notSignedIn: string;

  // Polling
  pausedIdle: (duration: string) => string;
  pausedSession: string;
  resumeUpdates: string;
  durationMinutes: (n: number) => string;
  durationSeconds: (n: number) => string;

  // Results
  resultView: string;
  summaryView: string;
  perStudentView: string;
  studentCount: (n: number) => string;
  correctSummary: (n: number, percent: string) => string;
  firstAttemptOnly: string;
  noAnswersYet: string;
  loadingResults: string;
  couldNotLoad: (reason: string) => string;
  attemptsFootnote: (min: string, avg: string, max: string) => string;
  averagePartialScore: (percent: string) => string;
  meanMedian: (mean: string, median: string) => string;
  correctValue: (value: string) => string;
  correctTag: string;
  tableStudent: string;
  tableAnswer: string;
  tableResult: string;
  tableAttempts: string;
  tableAnswered: string;

  // Answer formatting
  blankAnswer: string;
  nothingSelected: string;
  starsLabel: (n: number) => string;
  countOf: (n: number, total: number) => string;
  ratingOf: (value: number | string, max: number) => string;

  // Language picker
  languageLabel: string;
}

const en: Messages = {
  submit: 'Submit',
  submitting: 'Submitting…',
  tryAgain: 'Try again',
  answerSubmitted: 'Answer submitted.',
  correctVerdict: 'Correct',
  incorrectVerdict: 'Not quite',
  revealAnswerLabel: 'Correct answer:',
  alreadyAnswered: 'You have already answered this question.',
  savedOffline: 'Saved on this device — it will be sent when the connection returns.',
  chooseAnswerFirst: 'Choose or enter an answer first.',
  minLength: (n) => `Please write at least ${n} characters.`,
  enterNumber: 'Please enter a number.',
  attemptCount: (n) => (n === 1 ? '1 attempt' : `${n} attempts`),

  namePrompt: 'Enter your name to answer',
  namePlaceholder: 'First name',
  continueLabel: 'Continue',
  nameTooShort: (n) => `Please enter at least ${n} characters.`,
  logOut: 'Log out',
  notSignedIn: 'Not signed in',

  pausedIdle: (duration) => `Live updates paused after ${duration} of inactivity.`,
  pausedSession: 'Live updates paused — this page has been open for a while.',
  resumeUpdates: 'Resume live updates',
  durationMinutes: (n) => (n === 1 ? 'a minute' : `${n} minutes`),
  durationSeconds: (n) => (n === 1 ? 'a second' : `${n} seconds`),

  resultView: 'Result view',
  summaryView: 'Summary',
  perStudentView: 'Per student',
  studentCount: (n) => (n === 1 ? 'student' : 'students'),
  correctSummary: (n, percent) => `${n} correct (${percent})`,
  firstAttemptOnly: 'first attempt only',
  noAnswersYet: 'No answers yet.',
  loadingResults: 'Loading results…',
  couldNotLoad: (reason) => `Could not load results: ${reason}`,
  attemptsFootnote: (min, avg, max) =>
    `Attempts per student — min ${min} · avg ${avg} · max ${max}`,
  averagePartialScore: (percent) => `Average partial score: ${percent}`,
  meanMedian: (mean, median) => `mean ${mean} · median ${median}`,
  correctValue: (value) => `correct ${value}`,
  correctTag: 'correct',
  tableStudent: 'Student',
  tableAnswer: 'Answer',
  tableResult: 'Result',
  tableAttempts: 'Attempts',
  tableAnswered: 'Answered',

  blankAnswer: '(blank)',
  nothingSelected: '(nothing selected)',
  starsLabel: (n) => (n === 1 ? '1 star' : `${n} stars`),
  countOf: (n, total) => `${n} of ${total}`,
  ratingOf: (value, max) => `${value} of ${max}`,

  languageLabel: 'Language',
};

const fr: Messages = {
  submit: 'Envoyer',
  submitting: 'Envoi…',
  tryAgain: 'Réessayer',
  answerSubmitted: 'Réponse envoyée.',
  correctVerdict: 'Bonne réponse',
  incorrectVerdict: 'Pas tout à fait',
  revealAnswerLabel: 'Réponse correcte :',
  alreadyAnswered: 'Tu as déjà répondu à cette question.',
  savedOffline: "Enregistré sur cet appareil — l'envoi se fera au retour de la connexion.",
  chooseAnswerFirst: "Choisis ou saisis d'abord une réponse.",
  minLength: (n) => `Écris au moins ${n} caractères.`,
  enterNumber: 'Saisis un nombre.',
  attemptCount: (n) => (n === 1 ? '1 tentative' : `${n} tentatives`),

  namePrompt: 'Inscris ton nom pour répondre',
  namePlaceholder: 'Prénom',
  continueLabel: 'Continuer',
  nameTooShort: (n) => `Inscris au moins ${n} caractères.`,
  logOut: 'Déconnexion',
  notSignedIn: 'Non connecté',

  pausedIdle: (duration) => `Mise à jour en direct suspendue après ${duration} d'inactivité.`,
  pausedSession:
    'Mise à jour en direct suspendue — cette page est ouverte depuis un bon moment.',
  resumeUpdates: 'Reprendre la mise à jour',
  durationMinutes: (n) => (n === 1 ? 'une minute' : `${n} minutes`),
  durationSeconds: (n) => (n === 1 ? 'une seconde' : `${n} secondes`),

  resultView: 'Affichage des résultats',
  summaryView: 'Résumé',
  perStudentView: 'Par élève',
  studentCount: (n) => (n === 1 ? 'élève' : 'élèves'),
  correctSummary: (n, percent) =>
    n === 1 ? `${n} bonne réponse (${percent})` : `${n} bonnes réponses (${percent})`,
  firstAttemptOnly: 'première tentative seulement',
  noAnswersYet: "Aucune réponse pour l'instant.",
  loadingResults: 'Chargement des résultats…',
  couldNotLoad: (reason) => `Impossible de charger les résultats : ${reason}`,
  attemptsFootnote: (min, avg, max) =>
    `Tentatives par élève — min ${min} · moy ${avg} · max ${max}`,
  averagePartialScore: (percent) => `Score partiel moyen : ${percent}`,
  meanMedian: (mean, median) => `moyenne ${mean} · médiane ${median}`,
  correctValue: (value) => `bonne réponse ${value}`,
  correctTag: 'bonne réponse',
  tableStudent: 'Élève',
  tableAnswer: 'Réponse',
  tableResult: 'Résultat',
  tableAttempts: 'Tentatives',
  tableAnswered: 'Répondu',

  blankAnswer: '(vide)',
  nothingSelected: '(rien de sélectionné)',
  starsLabel: (n) => (n === 1 ? '1 étoile' : `${n} étoiles`),
  countOf: (n, total) => `${n} sur ${total}`,
  ratingOf: (value, max) => `${value} sur ${max}`,

  languageLabel: 'Langue',
};

const CATALOGUES: Record<Locale, Messages> = { fr, en };

// ---------------------------------------------------------------------------
// Current locale
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'askq.locale.v1';
const CHANNEL_NAME = 'askq.locale';

function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

function readStorage(): Locale | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return isLocale(raw) ? raw : null;
  } catch {
    return null;
  }
}

// Pinned to globalThis: see globalState.ts for why module scope is not enough.
const state = globalState('__askq_locale_v1', () => ({
  current: readStorage() ?? DEFAULT_LOCALE,
  listeners: new Set<(locale: Locale) => void>(),
  channel: null as BroadcastChannel | null,
  installed: false,
}));

function emit(): void {
  for (const listener of [...state.listeners]) listener(state.current);
}

function syncDocumentLang(): void {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = state.current;
}

function ensureChannel(): BroadcastChannel | null {
  if (state.channel || typeof BroadcastChannel === 'undefined') return state.channel;
  state.channel = new BroadcastChannel(CHANNEL_NAME);
  state.channel.onmessage = () => {
    state.current = readStorage() ?? DEFAULT_LOCALE;
    syncDocumentLang();
    emit();
  };
  return state.channel;
}

if (typeof window !== 'undefined' && !state.installed) {
  state.installed = true;
  window.addEventListener('storage', (event) => {
    if (event.key !== null && event.key !== STORAGE_KEY) return;
    state.current = readStorage() ?? DEFAULT_LOCALE;
    syncDocumentLang();
    emit();
  });
  ensureChannel();
  syncDocumentLang();
}

export function getLocale(): Locale {
  return state.current;
}

export function setLocale(locale: Locale): void {
  if (!isLocale(locale) || locale === state.current) return;
  state.current = locale;
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, locale);
    } catch {
      // Blocked storage: the choice just won't survive a reload.
    }
  }
  syncDocumentLang();
  emit();
  ensureChannel()?.postMessage({ type: 'locale' });
}

export function subscribeToLocale(listener: (locale: Locale) => void): () => void {
  state.listeners.add(listener);
  return () => {
    state.listeners.delete(listener);
  };
}

/** Messages for a specific locale, or the active one. */
export function getMessages(locale: Locale = state.current): Messages {
  return CATALOGUES[locale];
}

/** Test helper. */
export function resetLocale(): void {
  state.current = DEFAULT_LOCALE;
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignored
    }
  }
  emit();
}

// ---------------------------------------------------------------------------
// Locale-aware formatting
// ---------------------------------------------------------------------------

/** French writes 1,5 where English writes 1.5. */
export function formatNumber(value: number, locale: Locale = state.current): string {
  return new Intl.NumberFormat(LOCALE_TAGS[locale], { maximumFractionDigits: 2 }).format(value);
}

/** French writes "50 %" with a non-breaking space; English writes "50%". */
export function formatPercent(fraction: number, locale: Locale = state.current): string {
  return new Intl.NumberFormat(LOCALE_TAGS[locale], {
    style: 'percent',
    maximumFractionDigits: 0,
  }).format(fraction);
}

export function formatTime(iso: string, locale: Locale = state.current): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleTimeString(LOCALE_TAGS[locale], { hour: 'numeric', minute: '2-digit' });
}
