"use client";

export { AskQuestion, type AskQuestionProps } from './components/AskQuestion';
export { StudentBadge, type StudentBadgeProps } from './components/StudentBadge';
export { LanguagePicker, type LanguagePickerProps } from './components/LanguagePicker';
export { NameGate, type NameGateProps } from './components/NameGate';
export { IdleBanner } from './components/IdleBanner';
export { Markdown, type MarkdownProps } from './components/Markdown';

export { QuestionProvider, type QuestionProviderProps } from './providers';

export { defineGroup, type QuestionInput as QuestionDefinition } from './defineGroup';
export {
  questionKey,
  questionsInGroup,
  registeredGroupIds,
  registerQuestion,
  resolveQuestion,
  tryResolveQuestion,
  resetRegistry,
} from './registry';

export { configure, getConfig, isOfflineMode, resetRuntime, type AskqConfig, type Transport, type GroupSnapshot } from './runtime';
export { createMemoryTransport, createSupabaseTransport } from './transport';

export {
  getStudent,
  signIn,
  signOut,
  subscribeToIdentity,
  normaliseName,
  nameKey,
  randomId,
  resetIdentity,
  type Student,
} from './identity';

export {
  useLocale,
  useMessages,
  type LocaleControls,
} from './hooks';

export {
  DEFAULT_LOCALE,
  LOCALES,
  LOCALE_NAMES,
  LOCALE_TAGS,
  formatNumber,
  formatPercent,
  formatTime,
  getLocale,
  getMessages,
  setLocale,
  subscribeToLocale,
  resetLocale,
  type Locale,
  type Messages,
} from './i18n';

export { useIdleState, useQuestion, useStudent, type IdleControls } from './hooks';

export {
  installIdleWatcher,
  isPollingPaused,
  resumePolling,
  subscribeToIdle,
  type IdleReason,
} from './idle';

export {
  flushOutbox,
  getGroupSnapshot,
  recordLocalAnswer,
  refreshGroup,
  submitAnswer,
  subscribeToGroup,
} from './store';

export { outboxSize, clearOutbox } from './outbox';
export { clearLocalAttempts, getLocalAttemptCount } from './submissions';


export {
  formatAnswer,
  formatCorrectAnswer,
  gradeAnswer,
  isGraded,
  normaliseText,
  scoreAnswer,
} from './grade';

export { renderMarkdown, renderMarkdownBlock, renderMarkdownInline, escapeHtml } from './markdown';

export type {
  AnswerRow,
  AnswerValue,
  CheckboxesQuestion,
  ChoiceQuestion,
  LongTextQuestion,
  NumberQuestion,
  PendingAnswerRow,
  Question,
  QuestionBase,
  QuestionType,
  RatingQuestion,
  Reveal,
  ScaleQuestion,
  ShortTextQuestion,
} from './types';
