# Ask a Question

React components for asking students questions and showing a teacher what the class
answered. Built for a classroom: French and English interface, French by default, answers
stored one row per attempt, and a dashboard that updates live while the lesson is running.

Two components do the work:

```tsx
import { AskQuestion } from '@askq/react';
import { AnswerDashboard } from '@askq/react/dashboard';

// On the lesson page
<AskQuestion q={lessonOne.q1} />

// On the teacher's page
<AnswerDashboard show="all" />
```

Answers go straight from the browser to Supabase with an insert-only key. Reads go
through one server route holding the service-role key, so a student's browser can write
an answer but can never read the class's.

**Targets Next.js (App Router) and Astro.** Both speak the Web `Request`/`Response` types,
so the server half is the same one line in either.

---

## Contents

- [Install](#install)
- [Scripted setup](#scripted-setup)
- [Manual setup](#manual-setup)
- [Usage](#usage)
  - [Writing questions](#writing-questions)
  - [Question types](#question-types)
  - [A whole questionnaire on one page](#a-whole-questionnaire-on-one-page)
  - [Single questions inside a document](#single-questions-inside-a-document)
  - [The teacher dashboard](#the-teacher-dashboard)
  - [Sessions](#sessions)
  - [Exporting to CSV](#exporting-to-csv)
  - [Protecting the teacher side](#protecting-the-teacher-side)
  - [Language](#language)
  - [Identity](#identity)
  - [Astro notes](#astro-notes)
  - [Next.js notes](#nextjs-notes)
- [Configuration reference](#configuration-reference)
- [Security: what this does and does not protect](#security-what-this-does-and-does-not-protect)

---

## Install

The package is not on npm. Install it straight from git:

```bash
pnpm add "github:m-rantoine/question-component#path:/packages/ask-question"
npm  install "github:m-rantoine/question-component#path:/packages/ask-question"
```

It builds itself on install, so there is nothing to compile afterwards. React 18 or 19 is
a peer dependency.

Pin a version by adding a tag or commit before the `#`:

```bash
pnpm add "github:m-rantoine/question-component#v0.1.0&path:/packages/ask-question"
```

### If the repository is private

Locally this just works: package managers shell out to `git`, which uses the credentials
you already have.

**On Vercel it does not.** Vercel authenticates your project's repository, not arbitrary
git URLs in `package.json`. Its own documented answer is to put a personal access token
in the dependency URL, which commits the token to source control. Use a credential
rewrite instead, which keeps the token in an environment variable:

1. Add a `GH_PAT` environment variable to the Vercel project (a fine-grained token with
   read access to this repository).
2. Override the Install Command:

   ```bash
   git config --global url."https://$GH_PAT@github.com/".insteadOf "https://github.com/" && pnpm install --frozen-lockfile
   ```

This works precisely because the package manager delegates the fetch to `git`.

---

## Scripted setup

```bash
pnpm exec askq-setup
```

A walkthrough that drives the [Supabase CLI](https://supabase.com/docs/guides/local-development)
— install that first. The script:

1. Checks Node and the Supabase CLI.
2. Asks for a **local Docker stack** or a **hosted project**.
3. Runs `supabase init`, then `start` + `db reset` locally, or `link` + `db push` for a
   hosted project.
4. Copies this package's migrations into your `supabase/migrations/`, skipping any file
   already there.
5. Detects Next.js or Astro from your `package.json` and offers to write the API route at
   that framework's conventional path.
6. Writes the environment variables with the right prefixes, never replacing a value that
   is already set without asking.

| Flag | Effect |
| --- | --- |
| `--yes` | Accept every default; ask nothing. |
| `--dry-run` | Print every command and file write without performing any of them. |
| `--local` | Use a local Docker stack, skipping the prompt. |
| `--linked` | Use a hosted project, skipping the prompt. |
| `--no-route` | Do not write the API route. |
| `--no-env` | Do not write environment variables. |

Run `--dry-run` first if you want to see exactly what it will touch.

---

## Manual setup

### 1. Create a Supabase project

<https://supabase.com/dashboard> → **New project**. Any region; the free tier is plenty
for a class.

### 2. Apply the migrations

They ship inside this package, at `node_modules/@askq/react/supabase/migrations/`. Copy
them into your own `supabase/migrations/` and run `supabase db push`, or paste them into
the SQL editor in order:

- `0001_create_answers.sql` — the `answers` table, its constraints, indexes, and an
  insert-only RLS policy.
- `0002_add_session_id.sql` — adds the optional `session_id` column.

Both are safe to run more than once.

The table this produces:

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `text` primary key | Minted in the browser, so a retried request cannot duplicate a row. |
| `student_id` | `text` | Random per sign-in. Not an account. |
| `student_name` | `text` | What the student typed. |
| `session_id` | `text`, nullable | Class period, section or term. `null` means unscoped. |
| `group_id` | `text` | The question group. |
| `question_id` | `text` | Unique within its group. |
| `answer` | `jsonb` | String, array of strings, or number. |
| `created_at` | `timestamptz` | Set by Postgres. |

RLS is on, with **one** policy: anonymous `INSERT`. There is no select policy, so the
anon key cannot read a single row — which is the whole reason reads go through a server
route.

### 3. Collect the keys

Project settings → **API**:

| Key | Where it goes |
| --- | --- |
| Project URL | Client and server |
| `anon` / publishable | Client — safe there, it can only insert |
| `service_role` | **Server only.** Never prefix it `PUBLIC_` or `NEXT_PUBLIC_`. |

### 4. Set the environment variables

**Astro** — `.env`:

```bash
PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
PUBLIC_SUPABASE_ANON_KEY=eyJ…
SUPABASE_SERVICE_ROLE_KEY=eyJ…
```

**Next.js** — `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ…
SUPABASE_SERVICE_ROLE_KEY=eyJ…
```

### 5. Add the read route

Next.js — `app/api/answers/route.ts`:

```ts
import { createAnswersHandler } from '@askq/react/server';

export const dynamic = 'force-dynamic';
export const GET = createAnswersHandler();
```

Astro — `src/pages/api/answers.ts`:

```ts
import type { APIRoute } from 'astro';
import { createAnswersHandler } from '@askq/react/server';

export const prerender = false;
const handler = createAnswersHandler();
export const GET: APIRoute = ({ request }) => handler(request);
```

No framework adapter is needed: the handler takes a Web `Request` and returns a Web
`Response`, which is exactly what both frameworks hand it.

> **Astro dev:** `astro dev` loads `.env` onto `import.meta.env`, not `process.env`. If a
> variable comes back undefined in development, pass it explicitly:
> `createAnswersHandler({ serviceRoleKey: import.meta.env.SUPABASE_SERVICE_ROLE_KEY })`.

### 6. Configure the client

Once, at module scope:

```ts
import { configure } from '@askq/react';
import '@askq/react/styles.css';
import './questions/lesson-one'; // registers the questions

configure({
  supabaseUrl: import.meta.env.PUBLIC_SUPABASE_URL,
  supabaseAnonKey: import.meta.env.PUBLIC_SUPABASE_ANON_KEY,
  readEndpoint: '/api/answers',
});
```

With no credentials configured the components still run, keeping answers in memory for
the current page and warning once in the console — so `pnpm dev` works before any of the
above is done.

---

## Usage

### Writing questions

A question bank is a plain TypeScript module. `defineGroup` fills in `groupId` from its
first argument and `questionId` from each key, so those can never drift from the object
they sit in, and it validates each question at import time.

In Next.js import `defineGroup` from `@askq/react/questions` instead, so the bank can be
imported from a Server Component — see [Next.js notes](#nextjs-notes).

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

#### `showCorrectAnswer`

Feedback is only ever shown **after** a submission.

| Value | Student sees |
| --- | --- |
| `'never'` | "Answer submitted." Nothing about right or wrong. |
| `'if-correct'` | ✓ Correct / ✗ Not quite. Never the correct answer itself. |
| `'always'` | ✓ Correct / ✗ Not quite, **and** the correct answer. |

#### `allowMultipleAttempts`

`true` (the default) lets a student submit again; every attempt is stored and the
dashboard counts their **latest** one.

`false` locks the question in the browser after one submission. That lock lives in
`localStorage`, so it is UX rather than a control — clearing storage defeats it. Real
enforcement happens at read time: for a question with `allowMultipleAttempts: false`,
the dashboard counts each student's **earliest** attempt, so an extra submission that
slips through cannot displace the first answer.

### Question types

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
  a stored answer means. Editing an option's *text*, however, orphans every answer already
  stored against it — they stay in the per-student table but stop counting in the bars.
- **`groupId` and `questionId` must match `[A-Za-z0-9_.-]{1,64}`**, checked when the bank
  is defined. They appear in dashboard URLs and in a database column with the same
  constraint, so a space or a slash would otherwise fail at submit time, in front of a
  class.
- **Short-text grading** trims, collapses runs of whitespace, and lower-cases unless
  `caseSensitive: true`. For anything a variant list cannot express, pass
  `match: (raw) => boolean`.
- **Checkboxes** are marked right only on an exact set match. `partialCredit: true` adds
  an average partial score to the summary; it does not change the student's ✓/✗.
- **`number`** supports `config.tolerance` for "close enough" answers.

### A whole questionnaire on one page

Map over the bank. Each question stands on its own — one submission, one row, no "next"
button and no all-or-nothing submit at the end.

```tsx
import { AskQuestion, questionsInGroup } from '@askq/react';
import { lessonOne } from './questions/lesson-one';

export function Quiz() {
  return (
    <>
      <h1>Lesson one</h1>
      {questionsInGroup('lesson-1').map((question) => (
        <AskQuestion key={question.questionId} q={question} />
      ))}
    </>
  );
}
```

`questionsInGroup` returns them in declaration order, which is also the order the
dashboard's previous/next follows.

### Single questions inside a document

The same component, dropped into prose wherever a comprehension check belongs:

```mdx
The Rideau Canal froze in 1832, the year it opened…

<AskQuestion q={lessonOne.q1} />

Construction had begun six years earlier…

<AskQuestion q={lessonOne.q2} />
```

Nothing changes: answers from questions scattered through a document land in the same
group and appear together on the dashboard. Give the group an id that names the document
(`unit-1-lesson-3`) and the teacher's page is already organised.

### The teacher dashboard

```tsx
import { AnswerDashboard } from '@askq/react/dashboard';

<AnswerDashboard show="all" />
<AnswerDashboard show="groupPicker" />
<AnswerDashboard show="group" groupId="unit-1-lesson-1" />
<AnswerDashboard show="question" groupId="unit-1-lesson-1" questionId="question-1" navAll />
```

| Prop | Applies to | Default | Meaning |
| --- | --- | --- | --- |
| `show` | all | `'all'` | `'all'` · `'groupPicker'` · `'group'` · `'question'` |
| `groupId` | `group`, `question` | — | Required for those modes. |
| `questionId` | `question` | — | Required for that mode. |
| `navAll` | `question` | `true` | Previous/next across the group. |
| `view` | all | `'toggle'` | `'summary'`, `'per-student'`, or a switch between them. |
| `sessionId` | all | *(none)* | Show one session only. |
| `sessionPicker` | all | `false` | Render a session `<select>`. |
| `csv` | all | `true` | Render the download button. |
| `linkTo` | all | — | `(target) => string`; renders navigation as links. |
| `signOutHref` | all | — | Renders a sign-out link. |

**Navigation.** Without `linkTo` the component owns its own navigation: the group picker
and previous/next are buttons that re-render in place, which is what a drop-in component
needs when it knows nothing about your router. Supply `linkTo` and the same controls
become real links — bookmarkable, middle-clickable, `rel="prev"`/`rel="next"`, and inert
at the ends of a group:

```tsx
<AnswerDashboard
  show="question"
  groupId={groupId}
  questionId={questionId}
  linkTo={(target) =>
    target.kind === 'groups'
      ? '/teacher'
      : target.kind === 'group'
        ? `/teacher/${target.groupId}`
        : `/teacher/${target.groupId}/${target.questionId}`
  }
/>
```

**One request per group.** `show="all"` mounts one poller per group, not one per question,
so twenty questions still cost one request every five seconds.

**Polling.** Every five seconds while the page is active. It pauses after a minute without
activity, immediately when the tab goes to the background, and after thirty minutes
regardless — a dashboard left open on a projector does not poll all weekend. A banner
says why it paused; resuming is an explicit click, so moving the mouse across the screen
does not silently restart it.

### Sessions

A session is a run of the same questions: a class period, a section, or the same lesson
taught again next term. It is optional — leave it unset and every answer lands in one
pool per group, which is what a single class needs.

```ts
configure({ sessionId: 'period-2' });          // whole deployment
<AskQuestion q={lessonOne.q1} sessionId="p2" /> // one question
<AnswerDashboard show="all" sessionPicker />    // teacher picks
```

Two details worth knowing:

- Answers written before you started using sessions have `session_id = null`. They show
  under **All sessions** and are never rewritten.
- The single-attempt lock is per session, so a student locked out in period 1 is not
  still locked in period 2.

### Exporting to CSV

The dashboard's download button exports exactly what is on screen — the same group,
question and session. One row per attempt, with `is_counted` marking the one the summary
used, because a gradebook wants the full history.

Columns: `student_name`, `student_id`, `session_id`, `group_id`, `question_id`,
`question_text`, `answer`, `is_correct`, `attempt_number`, `is_counted`, `created_at`.

The file opens cleanly in Excel and Google Sheets: a UTF-8 BOM so accents survive, CRLF
line endings, and standard quoting. Any field beginning `=`, `+`, `-`, `@`, tab or CR is
prefixed with an apostrophe so a spreadsheet cannot run a student's answer as a formula.

Build your own with `toCsv`:

```ts
import { toCsv, useGroupAnswers } from '@askq/react/dashboard';
import { questionsInGroup } from '@askq/react';

const { rows } = useGroupAnswers({ groupId: 'lesson-1' });
const csv = toCsv({ questions: questionsInGroup('lesson-1'), rows, delimiter: ';' });
```

The delimiter defaults to `,` — right for en-CA and fr-CA Excel, and the only one Google
Sheets accepts without a prompt. Pass `';'` for an Excel set to fr-FR.

### Protecting the teacher side

```bash
ASKQ_TEACHER_USER=mme-antoine
ASKQ_TEACHER_PASSWORD=…
ASKQ_AUTH_SECRET=…        # openssl rand -base64 32
```

None of these takes a `PUBLIC_` or `NEXT_PUBLIC_` prefix. `createTeacherAuth()` throws if
any is missing or the secret is under 32 characters, rather than falling back to no
password.

```ts
// src/lib/teacher-auth.ts
import { createTeacherAuth } from '@askq/react/server';

export const auth = createTeacherAuth({ loginPath: '/teacher/login' });
```

**Guard the endpoint, not just the page.** Protecting only the page would look like
security and provide none — `/api/answers?groupId=lesson-1` returns every answer as JSON
to anyone who asks for it.

```ts
// Astro — src/middleware.ts
import { defineMiddleware } from 'astro:middleware';
import { auth } from './lib/teacher-auth';

export const onRequest = defineMiddleware(async ({ request, url }, next) => {
  const guarded = url.pathname.startsWith('/teacher') || url.pathname === '/api/answers';
  if (!guarded) return next();
  return (await auth.guard(request)) ?? next();
});
```

```ts
// Next.js — middleware.ts
import { auth } from './lib/teacher-auth';

export const config = { matcher: ['/teacher/:path*', '/api/answers'] };
export async function middleware(request: Request) {
  return (await auth.guard(request)) ?? undefined;
}
```

Then a login page and the two routes it posts to:

```tsx
import { TeacherLogin } from '@askq/react/dashboard';
<TeacherLogin action="/api/teacher/login" />;
```

```ts
// POST /api/teacher/login  ->  auth.login(request)
// GET  /api/teacher/logout ->  auth.logout()
```

`guard()` sends a browser to `loginPath` and answers a `fetch` with a bare `401`, so the
dashboard's poller gets something it can act on rather than a login page.

**Astro:** any page you guard must be rendered on demand (`export const prerender = false`).
A prerendered page is a static file the CDN serves without ever asking the server, so
middleware never runs for it.

The session is a signed, `HttpOnly` cookie holding the username and an expiry — never the
password — and credentials are compared as HMACs so the response timing does not leak the
password a character at a time. Login attempts are throttled per address in memory; on
serverless that is per-instance and therefore weak. It slows one attacker down; it does
not stop a distributed one.

### Language

French and English, French by default. Every component reads its text from a shared
store, so one picker switches all of them at once — including across separate Astro
islands — and the choice persists in `localStorage` and across tabs.

```tsx
import { LanguagePicker, useLocale } from '@askq/react';

<LanguagePicker />;
const { locale, messages, setLocale } = useLocale();
```

Numbers, percentages and times follow the locale: French writes `1,5` and `50 %` with a
non-breaking space; English writes `1.5` and `50%`.

**This covers the interface only.** Question text, options and correct answers are shown
exactly as written. Translating an option's text would orphan every answer already stored
against the old text — answers are matched by the option string, not its position.

### Identity

A student types a first name once; it is kept in `localStorage` with a random id and
reused on every question and every page.

```tsx
import { StudentBadge, NameGate, signOut } from '@askq/react';
```

`<AskQuestion>` renders the name prompt inline when nobody is signed in, so a student
never meets a blocked question with no way forward.

This is **not authentication**. Anyone can type any name. Two students sharing a name are
merged into one row on the dashboard, deliberately: a student who signs out and back in
gets a fresh id and should not appear twice.

### Astro notes

Island props are serialised as JSON, so a question cannot be passed as an object from a
`.astro` file. Pass its id and let the component resolve it:

```astro
---
import Question from '../components/Question.tsx';
import '../questions';  // registers the bank at build time
---
<Question client:load id="lesson-1/q1" />
```

```tsx
// src/components/Question.tsx
import '../lib/askq-config';   // configure() once, at module scope
import { AskQuestion } from '@askq/react';

export default function Question({ id }: { id: string }) {
  return <AskQuestion id={id} />;
}
```

Each island is its own React root, so no context can span them. All shared state —
configuration, language, identity, the question registry and the answer poller — lives on
a `globalThis`-pinned runtime instead, which is why islands stay in step.

The same rule applies to `linkTo` on `<AnswerDashboard>`: it is a function, so supply it
from a `.tsx` wrapper rather than from the `.astro` page.

### Next.js notes

`@askq/react` and `@askq/react/dashboard` ship with `"use client"`, so they can be
imported from a Server Component without any `'use client'` of your own.

**Write question banks against `@askq/react/questions`.** That entry carries no
`"use client"`, so a bank built on it can be imported from a Server Component *and* from a
client one:

```ts
// app/questions/lesson-one.ts
import { defineGroup } from '@askq/react/questions';

export const lessonOne = defineGroup('lesson-1', { /* … */ });
```

Import it from `@askq/react` instead and a Server Component importing the bank fails with
*"Attempted to call defineGroup() from the server"* — the App Router marks everything a
client module re-exports, `defineGroup` included.

Everything in `@askq/react/questions` is also exported from `@askq/react`, so an Astro or
client-only app can ignore the distinction.

The **question registry** is the other thing to know. `<AskQuestion id="lesson-1/q1" />`
resolves from a module-level registry, so the bank has to reach the browser bundle.
Importing it only in a Server Component leaves the client registry empty and
`resolveQuestion` throws. Two ways out:

- Import the bank from a `"use client"` module as well, or
- pass `q={question}` instead of `id` — a `Question` is a plain object and crosses the
  boundary fine.

Importing it from both is fine: registering the same bank twice is recognised and
ignored, and the registry itself lives on `globalThis` so the two copies stay in step.

**One exception:** a `short-text` question using `match: (raw) => boolean` cannot be
passed as `q` from a Server Component, because a function is not serialisable. Import
that bank on the client and use `id`.

---

## Configuration reference

```ts
configure({ … });         // module scope, last call wins
<QuestionProvider config={…}>  // or from inside a React tree
```

| Option | Default | Meaning |
| --- | --- | --- |
| `supabaseUrl` | — | Project URL. Without it, answers stay in memory. |
| `supabaseAnonKey` | — | Insert-only key. Safe in the client bundle. |
| `readEndpoint` | `'/api/answers'` | Server route that reads results. Absolute URLs work outside a browser. |
| `sessionId` | *(none)* | Default session for every answer. |
| `pollMs` | `5000` | Dashboard poll interval. |
| `idleMs` | `60000` | Inactivity before polling pauses. |
| `maxSessionMs` | `1800000` | Hard stop for a polling session. |
| `transport` | — | Replaces the built-in transport entirely. Used by tests. |

`createAnswersHandler(options)`:

| Option | Default | Meaning |
| --- | --- | --- |
| `supabaseUrl` | `SUPABASE_URL` → `PUBLIC_SUPABASE_URL` → `NEXT_PUBLIC_SUPABASE_URL` | |
| `serviceRoleKey` | `SUPABASE_SERVICE_ROLE_KEY` | |
| `maxRows` | `5000` | Cap on one read. |
| `authorize` | — | `(request) => Response \| null`; wire to `auth.guard`. |

`createTeacherAuth(options)`:

| Option | Default | Meaning |
| --- | --- | --- |
| `user` / `password` | `ASKQ_TEACHER_USER` / `ASKQ_TEACHER_PASSWORD` | |
| `secret` | `ASKQ_AUTH_SECRET` | 32 characters or more. |
| `cookieName` | `'askq_teacher'` | |
| `maxAgeSeconds` | `43200` | Twelve hours — a school day. |
| `loginPath` | `'/teacher/login'` | Where `guard()` sends a browser. |
| `secure` | `true` outside development | Adds `Secure` to the cookie. |

### Entry points

| Import | Contains |
| --- | --- |
| `@askq/react` | `AskQuestion`, `defineGroup`, the registry, config, identity, i18n, hooks |
| `@askq/react/questions` | `defineGroup`, the registry and the grading functions — **no `"use client"`**, so a Server Component can import a question bank |
| `@askq/react/dashboard` | `AnswerDashboard`, `SeeAnswers`, `TeacherLogin`, charts, aggregation, CSV |
| `@askq/react/server` | `createAnswersHandler`, `createTeacherAuth` |
| `@askq/react/styles.css` | The stylesheet |

The split is deliberate: a student page never downloads the charts, the aggregation code
or the CSV writer, none of which it can use.

---

## Security: what this does and does not protect

**Protected**

- Students cannot read each other's answers. The anon key has `INSERT` and nothing else;
  there is no select policy at all.
- The service-role key never reaches the browser.
- The teacher dashboard and `/api/answers` are behind one password, if you configure it.
- The session cookie is signed, `HttpOnly` and expiring; it never contains the password.
- Question text and answers are HTML-escaped everywhere they are rendered.
- CSV exports cannot execute a student's answer as a spreadsheet formula.

**Not protected**

- **The answer key is in the client bundle.** Grading is client-side so a question bank
  stays a plain TypeScript file a teacher can write and read. A student who opens devtools
  can find the answers. That is a deliberate trade for formative classroom use — anything
  summative needs grading moved to the server.
- **Names are not identities.** Anyone can type any name; nothing stops a student
  answering as someone else.
- **The attempt lock is client-side.** Clearing `localStorage` defeats it. Read-time
  scoring is the real rule.
- **Login throttling is per instance.** On serverless it slows one attacker down; it does
  not stop a distributed one.
- **Anyone can insert a row** with the anon key and a crafted request. Row shape is
  constrained by the database, but content is not vouched for.

---

## Licence

MIT.
