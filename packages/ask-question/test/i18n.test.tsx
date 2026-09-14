import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AskQuestion } from '../src/components/AskQuestion';
import { SeeAnswers } from '../src/components/SeeAnswers';
import { LanguagePicker } from '../src/components/LanguagePicker';
import { StudentBadge } from '../src/components/StudentBadge';
import { defineGroup } from '../src/defineGroup';
import { signIn } from '../src/identity';
import {
  DEFAULT_LOCALE,
  formatNumber,
  formatPercent,
  getLocale,
  getMessages,
  resetLocale,
  setLocale,
} from '../src/i18n';
import { configure } from '../src/runtime';
import { createMemoryTransport } from '../src/transport';
import type { AnswerRow } from '../src/types';

function bank() {
  return defineGroup('lesson-1', {
    q1: {
      type: 'multiple-choice',
      question: 'An apple is a',
      options: ['fruit', 'vegetable'],
      correctAnswer: 'fruit',
      showCorrectAnswer: 'always',
    },
  });
}

function textOf(selector: string): string {
  return document.querySelector(selector)?.textContent ?? '';
}

describe('interface language', () => {
  it('defaults to French', () => {
    // setup.ts pins English for the other suites; undo that here.
    resetLocale();
    expect(DEFAULT_LOCALE).toBe('fr');
    expect(getLocale()).toBe('fr');
    expect(getMessages().submit).toBe('Envoyer');
  });

  it('translates every catalogue key', () => {
    // Words that are genuinely spelled the same in both languages. Anything
    // else that matches is an untranslated string, not a coincidence.
    const SAME_IN_BOTH = new Set<string>([]);

    const en = getMessages('en') as unknown as Record<string, unknown>;
    const fr = getMessages('fr') as unknown as Record<string, unknown>;
    expect(Object.keys(fr).sort()).toEqual(Object.keys(en).sort());

    for (const key of Object.keys(en)) {
      expect(fr[key], `missing French for "${key}"`).toBeDefined();
      expect(typeof fr[key], `French "${key}" has the wrong shape`).toBe(typeof en[key]);
      if (typeof en[key] === 'string' && !SAME_IN_BOTH.has(key)) {
        expect(fr[key], `"${key}" was never translated`).not.toBe(en[key]);
      }
    }
  });

  it('renders the question interface in French', async () => {
    resetLocale();
    configure({ transport: createMemoryTransport() });
    signIn('Camille');
    render(<AskQuestion q={bank().q1} />);

    expect(await screen.findByRole('button', { name: 'Envoyer' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('radio', { name: 'vegetable' }));
    await userEvent.click(screen.getByRole('button', { name: 'Envoyer' }));

    expect(await screen.findByText('Pas tout à fait')).toBeInTheDocument();
    expect(screen.getByText(/Réponse correcte/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeInTheDocument();
    expect(screen.getByText('1 tentative')).toBeInTheDocument();
  });

  it('switches every mounted component when the picker is used', async () => {
    resetLocale();
    configure({ transport: createMemoryTransport() });
    signIn('Camille');
    render(
      <>
        <LanguagePicker />
        <StudentBadge />
        <AskQuestion q={bank().q1} />
      </>,
    );

    expect(await screen.findByRole('button', { name: 'Envoyer' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Déconnexion' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'English' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Submit' })).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Log out' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Envoyer' })).not.toBeInTheDocument();
  });

  it('remembers the choice across mounts', async () => {
    resetLocale();
    render(<LanguagePicker />);
    await userEvent.click(screen.getByRole('button', { name: 'English' }));
    expect(localStorage.getItem('askq.locale.v1')).toBe('en');
    expect(getLocale()).toBe('en');
  });

  it('translates the dashboard, including numbers and percentages', async () => {
    resetLocale();
    let seq = 0;
    const row = (name: string, answer: string): AnswerRow => {
      seq += 1;
      return {
        id: `r${seq}`,
        student_id: `s-${name}`,
        student_name: name,
        group_id: 'lesson-1',
        question_id: 'q1',
        answer,
        created_at: `2026-01-01T00:00:0${seq}.000Z`,
      };
    };
    configure({
      transport: createMemoryTransport([
        row('Ada', 'fruit'),
        row('Ada', 'fruit'),
        row('Grace', 'vegetable'),
      ]),
    });

    render(<SeeAnswers q={bank().q1} view="toggle" />);

    await waitFor(() => expect(textOf('.askq-answers__stats')).toMatch(/2 élèves/));
    expect(textOf('.askq-answers__stats')).toMatch(/1 bonne réponse/);
    // French decimal comma, not 1.5.
    expect(textOf('.askq-answers__footnote')).toBe(
      'Tentatives par élève — min 1 · moy 1,5 · max 2',
    );

    await userEvent.click(screen.getByRole('button', { name: 'Par élève' }));
    expect(screen.getByRole('columnheader', { name: 'Élève' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Tentatives' })).toBeInTheDocument();
  });

  it('formats numbers and percentages per locale', () => {
    expect(formatNumber(1.5, 'fr')).toBe('1,5');
    expect(formatNumber(1.5, 'en')).toBe('1.5');
    expect(formatPercent(0.5, 'en')).toBe('50%');
    // French uses a narrow no-break space before the percent sign.
    expect(formatPercent(0.5, 'fr').replace(/\s/g, ' ')).toBe('50 %');
  });
});
