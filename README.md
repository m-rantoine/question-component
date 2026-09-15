# question-component

A React component library for asking students questions and showing a teacher what the
class answered, plus a demo site that uses it.

**If you want to use the library in your own project, read
[`packages/ask-question/README.md`](packages/ask-question/README.md).** That is the full
documentation: install, scripted and manual setup, and usage.

Live demo: <https://question-component.vercel.app>

---

## Repository layout

```
packages/ask-question/     the library — React as a peer dependency
  src/
    types.ts               the question union
    defineGroup.ts         authoring helper and validation
    registry.ts            id → question, for Astro islands
    grade.ts               grading and formatting
    aggregate.ts           latest/earliest selection, tallies, histograms
    csv.ts                 the spreadsheet export
    identity.ts            the student in localStorage
    i18n.ts                French and English interface text
    runtime.ts             globalThis-pinned config and caches
    store.ts               the shared, refcounted poller
    idle.ts                activity tracking and the pause rules
    outbox.ts              retry queue for failed submissions
    auth.ts                teacher password, signed-cookie session (server only)
    server.ts              the /api/answers handler (server only)
    components/            AskQuestion, AnswerDashboard, SeeAnswers, inputs, charts
  bin/askq-setup.mjs       the scripted setup walkthrough
  supabase/migrations/     the database schema, applied by the Supabase CLI
apps/demo/                 Astro site deployed to Vercel
  src/middleware.ts        one guard for the dashboard and the read route
  src/pages/api/answers.ts the read route, one line over the package handler
```

The demo is the integration test: it consumes the library through `workspace:*`, so
anything that breaks for a consumer breaks the demo first.

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

`pnpm build:lib` also runs `scripts/check-build.mjs`, which asserts the two invariants
that otherwise fail silently: `"use client"` is the first line of every client bundle and
absent from the server one, and every entry ships declarations.

### Testing without a database

`createMemoryTransport()` swaps out Supabase entirely:

```ts
import { configure, createMemoryTransport } from '@askq/react';

configure({ transport: createMemoryTransport() });
```

That is what the test suite uses, and what the app falls back to when no credentials are
configured.

### Releasing

Consumers install from git, so a release is a tag:

```bash
git tag v0.1.0 && git push --tags
```

They then pin it with
`pnpm add "github:m-rantoine/question-component#v0.1.0&path:/packages/ask-question"`.

## Licence

MIT.
