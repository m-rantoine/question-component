import { defineGroup } from '@askq/react';

/**
 * Comprehension checks for the reading on the Rideau Canal.
 *
 * A separate group from `lesson-1`: a group is what the dashboard shows on one
 * page, so a document's own questions belong together and apart from a
 * questionnaire's.
 */
export const readingOne = defineGroup('reading-1', {
  q1: {
    type: 'short-text',
    question: 'En quelle année le canal Rideau a-t-il ouvert ?',
    correctAnswer: ['1832'],
    showCorrectAnswer: 'always',
    placeholder: 'Une année',
  },
  q2: {
    type: 'multiple-choice',
    question: 'Pourquoi le canal a-t-il été construit ?',
    options: [
      'Pour transporter des troupes en cas de guerre',
      'Pour irriguer les fermes de la vallée',
      'Pour produire de l’électricité',
    ],
    correctAnswer: 'Pour transporter des troupes en cas de guerre',
    showCorrectAnswer: 'if-correct',
  },
  q3: {
    type: 'long-text',
    question:
      'En une ou deux phrases, explique pourquoi on patine sur le canal l’hiver mais pas sur la rivière des Outaouais.',
    minLength: 20,
    rows: 3,
  },
});
