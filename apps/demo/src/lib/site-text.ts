import type { Locale } from '@askq/react';

/**
 * The demo site's own wording.
 *
 * The component library ships its own translations; this is only the prose that
 * belongs to these pages. Keys are shared across locales so a missing one is a
 * compile error.
 */
export const SITE_TEXT = {
  fr: {
    'site.brand': 'Pose une question',
    'site.footer':
      'Chaque tentative est enregistrée séparément — une reprise ne remplace jamais une réponse déjà donnée.',

    'home.title': 'Pose une question',
    'home.lede':
      'Une démonstration des composants : les élèves répondent aux questions d’une leçon, et chaque tentative est enregistrée séparément.',
    'home.lesson': 'Leçon un',
    'home.lessonNote': 'Neuf questions, une de chaque type.',
    'home.dashboard': 'Tableau de bord',
    'home.dashboardNote':
      'Le tableau de bord n’est lié depuis aucune page indexable. Pour l’instant, seule l’adresse le protège — voir le README avant de l’utiliser avec une vraie classe.',

    'lesson.title': 'Leçon un',
    'lesson.lede':
      'Réponds à chaque question séparément. Tu peux changer d’idée et répondre de nouveau, sauf indication contraire — toutes les tentatives sont conservées.',
    'lesson.docTitle': 'Leçon un — Pose une question',

    'dashboard.lede':
      'Mise à jour toutes les cinq secondes pendant que la page est active. Les requêtes s’arrêtent après une minute d’inactivité, ou dès que l’onglet passe en arrière-plan.',
    'dashboard.docTitle': 'Tableau de bord',
    'dashboard.allGroups': 'Tous les groupes',

    'setup.title': 'Mode démonstration.',
    'setup.body':
      'Aucun identifiant Supabase n’est configuré : les réponses restent en mémoire et disparaissent au rechargement.',
  },
  en: {
    'site.brand': 'Ask a Question',
    'site.footer':
      'Answers are stored one row per attempt — a retry never overwrites an earlier answer.',

    'home.title': 'Ask a Question',
    'home.lede':
      'A demo of the components: students answer questions on a lesson page, and every attempt is stored as its own row.',
    'home.lesson': 'Lesson one',
    'home.lessonNote': 'Nine questions, one of each type.',
    'home.dashboard': 'Teacher dashboard',
    'home.dashboardNote':
      'The dashboard is not linked from anywhere crawlable. For now the path is the only thing protecting it — see the README before using it with a real class.',

    'lesson.title': 'Lesson one',
    'lesson.lede':
      'Answer each question on its own. You can change your mind and submit again unless the question says otherwise — every attempt is kept.',
    'lesson.docTitle': 'Lesson one — Ask a Question',

    'dashboard.lede':
      'Updates every five seconds while this page is active. Polling pauses after a minute without activity, or as soon as the tab goes to the background.',
    'dashboard.docTitle': 'Teacher dashboard',
    'dashboard.allGroups': 'All groups',

    'setup.title': 'Demo mode.',
    'setup.body':
      'No Supabase credentials are configured, so answers are kept in memory for this page only and disappear on reload.',
  },
} satisfies Record<Locale, Record<string, string>>;

export type SiteKey = keyof (typeof SITE_TEXT)['fr'];

export function siteText(locale: Locale, key: SiteKey): string {
  return SITE_TEXT[locale][key];
}
