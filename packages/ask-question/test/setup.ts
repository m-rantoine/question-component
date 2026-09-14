import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { resetRegistry } from '../src/registry';
import { resetRuntime } from '../src/runtime';
import { resetIdentity } from '../src/identity';

beforeEach(() => {
  localStorage.clear();
  resetRegistry();
  resetRuntime();
  resetIdentity();
});

afterEach(() => {
  cleanup();
});
