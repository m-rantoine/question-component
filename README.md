# Ask a Question

React components for asking students a question and showing a teacher what the class
answered. Built to run as an Astro site on Vercel, with Supabase behind it.

Two components do the work:

```tsx
<AskQuestion q={questions.lessonOne.q1} />
<SeeAnswers  q={questions.lessonOne.q1} view="summary" />
```

Every submission is its own row. A second attempt never overwrites the first.

## Contents

- [Quick start](#quick-start)
- [Setting up Supabase](#setting-up-supabase)
- [Deploying to Vercel](#deploying-to-vercel)
- [Writing questions](#writing-questions)
- [Question types](#question-types)
- [Using the components](#using-the-components)
- [Using it from Astro](#using-it-from-astro)
- [The teacher dashboard](#the-teacher-dashboard)
- [Language](#language)
- [How students identify themselves](#how-students-identify-themselves)
- [Polling and idle behaviour](#polling-and-idle-behaviour)
- [Security: what this does and does not protect](#security-what-this-does-and-does-not-protect)
- [Repository layout](#repository-layout)
- [Development](#development)

## Quick start

Requires Node 20+ and pnpm 10+.

```bash
pnpm install
pnpm build:lib     # the demo imports the library's build output
pnpm dev           # http://localhost:4321
```

With no Supabase credentials configured the app runs in **demo mode**: answers are kept
in memory for the current page and disappear on reload. A banner says so. That is enough
to click through everything before setting up a database.

Pages:

| Path | What it is |
| --- | --- |
| `/` | Index |
| `/lessons/lesson-one` | Nine questions, one of each type |
| `/secretkey_abc123/teacher-dashboard` | Results for `lesson-1` |

## Setting up Supabase

### 1. Create a project

1. Sign in at [supabase.com](https://supabase.com) and click **New project**.
2. Give it a name, set a database password (save it somewhere; you will not need it for
   this app, but you will if you ever connect directly), and pick the region closest to
   your students.
3. Wait for provisioning to finish — a couple of minutes.

### 2. Create the table

1. In the project, open **SQL Editor** → **New query**.
2. Paste the entire contents of [`supabase/schema.sql`](supabase/schema.sql) and click
   **Run**.

That creates the `answers` table, its indexes, and the row-level security policy. The
script is safe to run more than once.

What the policy does: the public `anon` key gets `INSERT` and nothing else — no `SELECT`,
no `UPDATE`, no `DELETE`. Students can add an attempt and cannot read anyone's answers,
edit their own, or delete anything.

### 3. Collect the keys

Open **Project Settings** → **API keys**. You need three values:

| Value | Where it goes | Notes |
| --- | --- | --- |
| Project URL | `PUBLIC_SUPABASE_URL` | e.g. `https://abcdefgh.supabase.co` |
| `anon` / publishable key | `PUBLIC_SUPABASE_ANON_KEY` | Ships in the browser bundle. Safe, because of the policy above. |
| `service_role` / secret key | `SUPABASE_SERVICE_ROLE_KEY` | **Server only.** Bypasses RLS entirely. |

> The `service_role` key must never be prefixed with `PUBLIC_` and must never be imported
> by a component. Only `src/pages/api/answers.ts` reads it. Anyone holding it has full
> read and write access to the whole database.

### 4. Point the app at it

```bash
cp .env.example apps/demo/.env
```

Then fill in the three values. Restart `pnpm dev` — the demo-mode banner disappears and
answers start landing in the table. You can watch them arrive in Supabase under **Table
Editor** → **answers**.

### 5. Check it worked

1. Open `/lessons/lesson-one`, enter a name, answer a question.
2. In Supabase, **Table Editor** → **answers** — the row should be there.
3. Open `/secretkey_abc123/teacher-dashboard` — the answer should appear within five
   seconds.

If the dashboard stays empty but rows exist in the table, the server is missing
`SUPABASE_SERVICE_ROLE_KEY`; `/api/answers` returns a 503 with a message saying so.

## Deploying to Vercel

1. Push this repository to GitHub.
2. In Vercel, **Add New** → **Project**, and import the repository.
3. Set the **Root Directory** to `apps/demo`.
4. Leave the build command alone. `apps/demo/vercel.json` sets it to
   `pnpm --filter @askq/react build && astro build`, because the demo imports the
   library's build output and `pnpm install` does not build a workspace dependency on
   its own.
5. Under **Settings** → **Environment Variables**, add all three values from step 3
   above, for Production, Preview and Development.
6. Deploy.

The site builds as static HTML plus one serverless function for `/api/answers`.

> Redeploy after adding or changing environment variables. `PUBLIC_` values are baked
> into the client bundle at build time, so a running deployment will not pick them up
> until it is rebuilt.

Without the environment variables the deployment still builds and serves: the client
falls back to in-memory demo mode and shows a banner, and `/api/answers` returns a 503
explaining what is missing.

### Never commit the keys

`.gitignore` covers `.env`, and nothing in this repository contains a credential.
The Supabase URL and publishable key are safe in a browser bundle but still belong in
Vercel's environment variables rather than in a committed file, so the project can be
pointed at a different Supabase instance without a code change.

Note that GitHub repository secrets are **not** a substitute here: Vercel's Git
integration builds on Vercel's own infrastructure and reads Vercel environment
variables. GitHub secrets are only visible to GitHub Actions workflows, of which this
repository has none.

## Writing questions

A question bank is a plain TypeScript module. `defineGroup` fills in `groupId` from its
first argument and `questionId` from each key, so those can never drift from the object
they sit in, and it validates each question at import time.

```ts
// src/questions/lesson-one.ts
import { defineGroup } from '@askq/react';

export const lessonOne = defineGroup('lesson-1', {
  q1: {
    type: 'short-text',
    question: 'What is **1 + 1**?',
    correctAnswer: ['2', 'two'],
    showCorrectAnswer: 'always',
  },
  q2: {
    type: 'multiple-choice',
    question: 'An apple is a',
    options: ['fruit', 'vegetable', 'rock', 'vehicle'],
    correctAnswer: 'fruit',
  },
});
```

`question` is markdown. The supported subset is `**bold**`, `*italic*` / `_italic_`,
`` `code` ``, `~~strike~~` and `[links](https://example.com)`, plus paragraphs and `- `
lists in block contexts. Everything is HTML-escaped before any markup is produced, so a
question can never inject a tag.

Shared fields:

| Field | Default | Meaning |
| --- | --- | --- |
| `question` | — | Markdown question text. |
| `correctAnswer` | *(none)* | Optional everywhere. A question without one is a survey, not a test. |
| `showCorrectAnswer` | `'never'` | What the student is told after submitting — see below. |
| `allowMultipleAttempts` | `true` | `false` locks the question after one submission. |

### `showCorrectAnswer`

Feedback is only ever shown **after** a submission.

| Value | Student sees |
| --- | --- |
| `'never'` | "Answer submitted." Nothing about right or wrong. |
| `'if-correct'` | ✓ Correct / ✗ Not quite. Never the correct answer itself. |
| `'always'` | ✓ Correct / ✗ Not quite, **and** the correct answer. |

### `allowMultipleAttempts`

`true` (the default) lets a student submit again; every attempt is stored and the
dashboard counts their **latest** one.

`false` locks the question in the browser after one submission. That lock lives in
`localStorage`, so it is UX rather than a control — clearing storage defeats it. Real
enforcement happens at read time: for a question with `allowMultipleAttempts: false`,
the dashboard counts each student's **earliest** attempt, so an extra submission that
slips through cannot displace the first answer.

## Question types

| `type` | Renders as | `correctAnswer` | Extra fields |
| --- | --- | --- | --- |
| `short-text` | One-line text input | `string[]` — any variant matches | `caseSensitive`, `match`, `placeholder`, `maxLength` |
| `long-text` | Textarea (never graded) | — | `minLength`, `maxLength`, `rows`, `placeholder` |
| `multiple-choice` | Radio list | `string` — the option's text | `options` |
| `button-choice` | Same data, tap targets | `string` | `options` |
| `checkboxes` | Checkbox list | `string[]` | `options`, `partialCredit` |
| `number` | Number input | `number` | `config.min`, `config.max`, `config.step`, `config.tolerance` |
| `scale` | Numbered steps, or a slider past 21 steps | `number` | `config.min`, `config.max`, `config.countBy`, `config.minLabel`, `config.maxLabel` |
| `rating` | Stars | `number` | `config.max` (default 5) |

Notes:

- **Choices are matched by text, not index**, so reordering `options` never changes what
  a stored answer means.
- **Short-text grading** trims, collapses runs of whitespace, and lower-cases unless
  `caseSensitive: true`. For anything a variant list cannot express, pass
  `match: (raw) => boolean`.
- **Checkboxes** are marked right only on an exact set match. `partialCredit: true` adds
  an average partial score to the summary; it does not change the student's ✓/✗.
- **`number`** supports `config.tolerance` for "close enough" answers.

## Using the components

```tsx
import { AskQuestion, SeeAnswers, StudentBadge, configure } from '@askq/react';
import '@askq/react/styles.css';

configure({
  supabaseUrl: import.meta.env.PUBLIC_SUPABASE_URL,
  supabaseAnonKey: import.meta.env.PUBLIC_SUPABASE_ANON_KEY,
  readEndpoint: '/api/answers',
  pollMs: 5000,
  idleMs: 60_000,
});
```

`configure()` writes to a runtime pinned on `globalThis`, so it can be called from every
entry point and the last value wins. `<QuestionProvider config={…}>` does the same thing
from inside a React tree, for apps that prefer a provider.

### `<AskQuestion>`

| Prop | Type | Notes |
| --- | --- | --- |
| `q` | `Question` | The question object. |
| `id` | `string` | `"<groupId>/<questionId>"`. Use instead of `q` in Astro. |
| `namePrompt` | `string` | Text above the name field. |
| `onSubmitted` | `(result) => void` | `{ value, correct, attempt }`. |
| `className` | `string` | Added to the root element. |

Exactly one of `q` or `id` is required.

### `<SeeAnswers>`

| Prop | Type | Notes |
| --- | --- | --- |
| `q` / `id` | — | As above. |
| `view` | `'summary' \| 'per-student' \| 'toggle'` | Defaults to `'summary'`. |
| `hideQuestion` | `boolean` | Omit the question text. |

## Using it from Astro

Astro serialises island props to JSON, so **a question object cannot be passed to an
island**. Pass its id instead and let the component resolve it:

```astro
---
import Question from '../components/Question.tsx';
import { lessonOne } from '../questions';

const ids = Object.values(lessonOne).map((q) => `${q.groupId}/${q.questionId}`);
---

{ids.map((id) => <Question client:load id={id} />)}
```

The island itself imports the bank, which is what registers the questions:

```tsx
// src/components/Question.tsx
import '../lib/askq-config';   // calls configure() and imports the question bank
import { AskQuestion } from '@askq/react';

export default function Question({ id }: { id: string }) {
  return <AskQuestion id={id} />;
}
```

Passing the object directly still works from plain React and MDX, where there is no
serialisation boundary.

### One poller per page

Each Astro island is its own React root, and React context cannot cross between them.
The shared answer cache is therefore pinned to `globalThis`, so every island on a page —
however Vite chunks the build — talks to the same poller and the same cache.

That is why the dashboard is a **single island** wrapping every `SeeAnswers`: nine
questions cost one request every five seconds, not nine.

```tsx
<AnswersProvider groupId="lesson-1">
  {questionIds.map((id) => <SeeAnswers key={id} id={id} view="toggle" />)}
</AnswersProvider>
```

## The teacher dashboard

`summary` shows, per type:

- **choice types** — a bar per option with counts and percentages, correct option
  tagged;
- **checkboxes** — the same, plus an average partial score when `partialCredit` is on;
- **short-text** — distinct answers by frequency, with spelling variants folded together;
- **long-text** — the responses themselves, newest first;
- **number / scale / rating** — a histogram across the configured range, plus mean and
  median.

Every summary counts one attempt per student — the latest, or the earliest for a question
with `allowMultipleAttempts: false` — and ends with a quiet line reading
`Attempts per student — min 1 · avg 1.4 · max 3`.

`per-student` is a table of student, answer, ✓/✗, attempt count and time. Where a student
made more than one attempt, the count expands into the full history.

`toggle` renders both with a switch between them.

## Language

The interface ships in **French and English, with French as the default**, and a picker
in the header switches between them.

```tsx
import { LanguagePicker } from '@askq/react';

<LanguagePicker />                  // segmented control (default)
<LanguagePicker variant="select" /> // native dropdown
```

The choice is stored per browser in `localStorage` and broadcast, so every question, the
dashboard, the student badge and the page's own prose switch together — across Astro
islands and across open tabs. `<html lang>` and `<title>` follow it too. Numbers,
percentages and times are formatted per locale: French renders `moy 1,5` and `100 %`
where English renders `avg 1.5` and `100%`.

A browser set to English still starts in French — the default is deliberate, not
negotiated with `navigator.language`. To change that, or to read the browser's
preference instead, see `DEFAULT_LOCALE` in `packages/ask-question/src/i18n.ts`.

### Adding or changing wording

Translations live in one file, `packages/ask-question/src/i18n.ts`, as a typed
`Messages` object rather than string keys — so a missing or misspelled message is a
compile error, not a blank label in front of a class. A test asserts that both
catalogues have exactly the same keys and that no French string was left as its English
original.

The demo site's own prose (headings, footer, the demo-mode notice) lives separately in
`apps/demo/src/lib/site-text.ts`, since it belongs to the pages rather than the library.

### Question text does not follow the picker

Questions, options and correct answers are shown exactly as the question bank writes
them. This is deliberate, and it is a data-integrity constraint rather than an
oversight: the stored answer for a choice question **is the option's own text**, so if
options were translated at runtime the same answer would land in the database as
`"fruit"` for one student and `"légume"` for another, and every summary would split in
half.

Making questions bilingual properly means giving each option a stable id that is stored,
plus a per-language label that is only displayed. That is a schema change worth doing
deliberately — the sample bank in `apps/demo/src/questions/lesson-one.ts` is written in
French for now.

## How students identify themselves

A student types their name once. It is stored in `localStorage` as
`{ id, name, savedAt }`, where `id` is a generated UUID.

The **Log out** button in the header clears it so another student can use the same
browser. Logging out is broadcast across islands and tabs, so every question on the page
returns to its name prompt immediately.

Signing back in mints a **new** id. The dashboard therefore groups attempts by normalised
name rather than by id, so one student appears once. The trade-off is deliberate and worth
knowing: two students who share a name are merged into one row.

## Polling and idle behaviour

The dashboard polls `/api/answers` every five seconds, asking only for rows newer than
the newest it already holds (with a two-second overlap, de-duplicated by row id).

Polling stops when:

- the tab goes to the background — immediately, via `visibilitychange`;
- there has been no activity for 60 seconds — pointer, keyboard, touch, scroll or focus,
  not just mouse movement, since a teacher watching the projector never moves the mouse
  and a tablet never fires `mousemove`;
- the page has been open for 30 minutes, whatever the activity.

A background-tab pause clears itself when the tab comes back. An **idle pause does not**:
a banner appears at the top and polling only restarts when someone presses **Resume live
updates**. Moving the mouse is not enough, by design.

Requests are chained with `setTimeout` rather than `setInterval`, so a slow response can
never stack another request on top of itself, and failures back off exponentially to a
minute.

### Offline submissions

If a submission fails to reach the server it is queued in `localStorage` and retried when
the connection returns. This is safe because the row id is generated in the browser: a
duplicate insert is rejected by the primary key and treated as success. The student sees
"Saved on this device — it will be sent when the connection returns."

Note that `created_at` is set by the database on insert, so a queued answer is timestamped
when it syncs, not when it was written.

## Security: what this does and does not protect

This is an MVP for classroom use. Being explicit about the edges:

**What holds.**

- Students cannot read the class's answers. The anon key has no `SELECT` privilege at
  all, and all reads go through a server route holding the service-role key.
- Attempts cannot be edited or deleted from the browser. The anon key has no `UPDATE` or
  `DELETE` privilege, and the table is append-only in practice.
- Answers are rendered as text and all markdown is escaped before rendering, so no
  submitted content can inject markup.

**What does not.**

- **The answer key is in the browser bundle.** Grading happens client-side, so a student
  who opens devtools can read the correct answers. That is fine for formative classroom
  use and not fine for anything that counts. To change it, move grading into
  `/api/answers` or ship the answer key only to a dashboard-only bundle — the question
  registry sits behind a `resolveQuestion()` interface to make that a contained change.
- **The dashboard is protected by an obscure path only.** `/secretkey_abc123/…` is
  `noindex` and not linked from anywhere crawlable, but anyone who learns the URL can
  open it. Before using this with a real class, put a real lock on it: Vercel's built-in
  password protection, or Astro middleware checking a shared secret against an
  environment variable. Do not add the path to `robots.txt` — a `Disallow` rule publishes
  the very URL it is meant to hide.
- **Anyone can post answers.** The anon key allows inserts from anywhere, and names are
  self-asserted, so a student can answer as someone else. There is no rate limiting.
  Real identity needs real auth.

## Repository layout

```
packages/ask-question/     the library — React as a peer dependency
  src/
    types.ts               the question union
    defineGroup.ts         authoring helper and validation
    registry.ts            id → question, for Astro islands
    grade.ts               grading and formatting
    aggregate.ts           latest/earliest selection, tallies, histograms
    identity.ts            the student in localStorage
    runtime.ts             globalThis-pinned config and caches
    store.ts               the shared, refcounted poller
    idle.ts                activity tracking and the pause rules
    outbox.ts              retry queue for failed submissions
    components/            AskQuestion, SeeAnswers, inputs, charts
apps/demo/                 Astro site deployed to Vercel
  src/pages/api/answers.ts the one server route
supabase/schema.sql        table, indexes, RLS
```

## Development

```bash
pnpm dev             # Astro dev server for the demo
pnpm build           # build the library, then the site
pnpm build:lib       # library only — run after editing packages/ask-question
pnpm test            # vitest
pnpm typecheck       # tsc for the library, astro check for the site
```

The demo imports the library's **build output**, so after changing library source run
`pnpm build:lib` (or `pnpm --filter @askq/react dev` to rebuild on save).

### Testing without a database

`createMemoryTransport()` swaps out Supabase entirely:

```ts
import { configure, createMemoryTransport } from '@askq/react';

configure({ transport: createMemoryTransport() });
```

That is what the test suite uses, and what the app falls back to when no credentials are
configured.

### Publishing the library

`packages/ask-question` builds to ESM and CJS with type declarations and has no runtime
dependencies — React is a peer dependency. Rename `@askq/react` in its `package.json` to
a name you own before publishing.
