import { defineGroup } from '@askq/react';

/**
 * A question bank. `defineGroup` fills in `groupId` from the first argument and
 * `questionId` from each key, so neither can drift from the object it sits in.
 */
export const lessonOne = defineGroup('lesson-1', {
  q1: {
    type: 'short-text',
    question: 'What is **1 + 1**?',
    correctAnswer: ['2', 'two'],
    showCorrectAnswer: 'always',
    placeholder: 'Your answer',
  },
  q2: {
    type: 'multiple-choice',
    question: 'An apple is a',
    options: ['fruit', 'vegetable', 'rock', 'vehicle'],
    correctAnswer: 'fruit',
    showCorrectAnswer: 'if-correct',
  },
  q3: {
    type: 'scale',
    question: 'How many planets orbit the sun?',
    config: { min: 0, max: 20, countBy: 1 },
    correctAnswer: 8,
    showCorrectAnswer: 'always',
  },
  q4: {
    type: 'button-choice',
    question: 'Which of these is a _mammal_?',
    options: ['Shark', 'Dolphin', 'Crocodile', 'Eagle'],
    correctAnswer: 'Dolphin',
    showCorrectAnswer: 'if-correct',
  },
  q5: {
    type: 'checkboxes',
    question: 'Select every **prime** number.',
    options: ['2', '4', '7', '9', '11'],
    correctAnswer: ['2', '7', '11'],
    partialCredit: true,
    showCorrectAnswer: 'always',
  },
  q6: {
    type: 'number',
    question: 'Roughly how many kilometres is it from the Earth to the Moon, in thousands?',
    config: { min: 0, max: 1000, step: 1, tolerance: 20 },
    correctAnswer: 384,
    showCorrectAnswer: 'always',
  },
  q7: {
    type: 'long-text',
    question: 'In a sentence or two, explain **why** the seasons change.',
    minLength: 20,
    rows: 4,
    // No correct answer: this one is read, not graded.
  },
  q8: {
    type: 'rating',
    question: 'How confident do you feel about this lesson?',
    config: { max: 5 },
    // Ungraded on purpose — a survey, not a test.
  },
  q9: {
    type: 'multiple-choice',
    question: 'Exit ticket: was the pace of today’s lesson about right?',
    options: ['Too slow', 'About right', 'Too fast'],
    allowMultipleAttempts: false,
  },
});

export const questions = { lessonOne };
