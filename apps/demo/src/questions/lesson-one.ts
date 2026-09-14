import { defineGroup } from '@askq/react';

/**
 * A question bank. `defineGroup` fills in `groupId` from the first argument and
 * `questionId` from each key, so neither can drift from the object it sits in.
 *
 * Question text, options and correct answers are shown exactly as written here —
 * they do NOT follow the interface language picker. The stored answer for a
 * choice question is the option's own text, so translating options at runtime
 * would make the same answer land in the database under two different values
 * and split every summary in half. See the README.
 */
export const lessonOne = defineGroup('lesson-1', {
  q1: {
    type: 'short-text',
    question: 'Combien font **1 + 1** ?',
    correctAnswer: ['2', 'deux'],
    showCorrectAnswer: 'always',
    placeholder: 'Ta réponse',
  },
  q2: {
    type: 'multiple-choice',
    question: 'Une pomme est un',
    options: ['fruit', 'légume', 'minéral', 'véhicule'],
    correctAnswer: 'fruit',
    showCorrectAnswer: 'if-correct',
  },
  q3: {
    type: 'scale',
    question: 'Combien de planètes tournent autour du Soleil ?',
    config: { min: 0, max: 20, countBy: 1 },
    correctAnswer: 8,
    showCorrectAnswer: 'always',
  },
  q4: {
    type: 'button-choice',
    question: 'Lequel de ces animaux est un _mammifère_ ?',
    options: ['Requin', 'Dauphin', 'Crocodile', 'Aigle'],
    correctAnswer: 'Dauphin',
    showCorrectAnswer: 'if-correct',
  },
  q5: {
    type: 'checkboxes',
    question: 'Choisis tous les nombres **premiers**.',
    options: ['2', '4', '7', '9', '11'],
    correctAnswer: ['2', '7', '11'],
    partialCredit: true,
    showCorrectAnswer: 'always',
  },
  q6: {
    type: 'number',
    question:
      'Environ combien de milliers de kilomètres séparent la Terre de la Lune ?',
    config: { min: 0, max: 1000, step: 1, tolerance: 20 },
    correctAnswer: 384,
    showCorrectAnswer: 'always',
  },
  q7: {
    type: 'long-text',
    question: 'En une ou deux phrases, explique **pourquoi** les saisons changent.',
    minLength: 20,
    rows: 4,
    // No correct answer: this one is read, not graded.
  },
  q8: {
    type: 'rating',
    question: 'À quel point te sens-tu à l’aise avec cette leçon ?',
    config: { max: 5 },
    // Ungraded on purpose — a survey, not a test.
  },
  q9: {
    type: 'multiple-choice',
    question: 'Billet de sortie : le rythme de la leçon d’aujourd’hui était-il bon ?',
    options: ['Trop lent', 'Juste bien', 'Trop rapide'],
    allowMultipleAttempts: false,
  },
});

export const questions = { lessonOne };
