import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { resetRegistry } from '../src/registry';
import { resetRuntime } from '../src/runtime';
import { resetIdentity } from '../src/identity';
import { resetLocale, setLocale } from '../src/i18n';

beforeEach(() => {
  localStorage.clear();
  resetRegistry();
  resetRuntime();
  resetIdentity();
  // French is the product default; tests pin English so assertions read
  // naturally. i18n.test.tsx covers the French default and switching.
  resetLocale();
  setLocale('en');
});

afterEach(() => {
  cleanup();
});
