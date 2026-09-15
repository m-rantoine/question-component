#!/usr/bin/env node
/**
 * Interactive setup for a project that has just installed @askq/react.
 *
 * It drives the Supabase CLI rather than reimplementing it: the CLI already
 * knows how to start a local stack, link a hosted project and apply migrations
 * in order, and a teacher following the README should end up with the same
 * database state either way.
 *
 * No dependencies, so `pnpm exec askq-setup` works straight after install.
 *
 * Flags:
 *   --yes        accept every default, ask nothing
 *   --dry-run    print every command and file write without doing any of it
 *   --local      use a local Docker stack (skips the prompt)
 *   --linked     use a hosted Supabase project (skips the prompt)
 *   --no-route   do not write the API route
 *   --no-env     do not write environment variables
 */

import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const MIN_NODE_MAJOR = 18;
const HERE = dirname(fileURLToPath(import.meta.url));
const PACKAGE_MIGRATIONS = join(HERE, '..', 'supabase', 'migrations');
const CWD = process.cwd();

const flags = new Set(process.argv.slice(2));
const YES = flags.has('--yes');
const DRY_RUN = flags.has('--dry-run');
const NO_ROUTE = flags.has('--no-route');
const NO_ENV = flags.has('--no-env');

const bold = (text) => `[1m${text}[0m`;
const dim = (text) => `[2m${text}[0m`;
const step = (text) => console.log(`\n${bold(text)}`);
const note = (text) => console.log(`  ${text}`);
const planned = (text) => console.log(`  ${dim(`would ${text}`)}`);

let rl = null;
function prompt() {
  rl ??= createInterface({ input: process.stdin, output: process.stdout });
  return rl;
}

async function ask(question, fallback = '') {
  if (YES) return fallback;
  const answer = (await prompt().question(`  ${question}${fallback ? ` [${fallback}]` : ''} `)).trim();
  return answer || fallback;
}

async function confirm(question, fallback = true) {
  if (YES) return fallback;
  const answer = (await ask(`${question} (y/n)`, fallback ? 'y' : 'n')).toLowerCase();
  return answer.startsWith('y');
}

function run(command, args, { capture = false } = {}) {
  if (DRY_RUN) {
    planned(`run: ${command} ${args.join(' ')}`);
    return { status: 0, stdout: '' };
  }
  const result = spawnSync(command, args, {
    stdio: capture ? ['inherit', 'pipe', 'inherit'] : 'inherit',
    encoding: 'utf8',
    cwd: CWD,
  });
  return { status: result.status ?? 1, stdout: result.stdout ?? '' };
}

function fail(message) {
  console.error(`\n[31m${message}[0m\n`);
  rl?.close();
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 1. Preflight
// ---------------------------------------------------------------------------

function checkNode() {
  const major = Number(process.versions.node.split('.')[0]);
  if (major < MIN_NODE_MAJOR) {
    fail(`Node ${MIN_NODE_MAJOR}+ is required; this is ${process.versions.node}.`);
  }
  note(`Node ${process.versions.node}`);
}

function checkSupabaseCli() {
  const result = spawnSync('supabase', ['--version'], { encoding: 'utf8' });
  if (result.status !== 0) {
    fail(
      'The Supabase CLI is not on PATH.\n\n' +
        '  Install it with one of:\n' +
        '    brew install supabase/tap/supabase\n' +
        '    npm install --save-dev supabase\n' +
        '    scoop install supabase\n\n' +
        '  Then run this again. See https://supabase.com/docs/guides/local-development',
    );
  }
  note(`Supabase CLI ${result.stdout.trim()}`);
}

// ---------------------------------------------------------------------------
// 2. Framework detection
// ---------------------------------------------------------------------------

async function detectFramework() {
  let manifest = {};
  try {
    manifest = JSON.parse(await readFile(join(CWD, 'package.json'), 'utf8'));
  } catch {
    return null;
  }
  const deps = { ...manifest.dependencies, ...manifest.devDependencies };
  if (deps.next) return 'next';
  if (deps.astro) return 'astro';
  return null;
}

const FRAMEWORKS = {
  next: {
    label: 'Next.js',
    envFile: '.env.local',
    urlVar: 'NEXT_PUBLIC_SUPABASE_URL',
    keyVar: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    routePath: join('app', 'api', 'answers', 'route.ts'),
    route: `import { createAnswersHandler } from '@askq/react/server';

// Reads answers with the service-role key. The anon key the browser holds is
// insert-only, so every dashboard read comes through here.
export const dynamic = 'force-dynamic';

export const GET = createAnswersHandler();
`,
  },
  astro: {
    label: 'Astro',
    envFile: '.env',
    urlVar: 'PUBLIC_SUPABASE_URL',
    keyVar: 'PUBLIC_SUPABASE_ANON_KEY',
    routePath: join('src', 'pages', 'api', 'answers.ts'),
    route: `import type { APIRoute } from 'astro';
import { createAnswersHandler } from '@askq/react/server';

// Rendered on demand: this route needs the service-role key at request time.
export const prerender = false;

const handler = createAnswersHandler();

export const GET: APIRoute = ({ request }) => handler(request);
`,
  },
};

// ---------------------------------------------------------------------------
// 3. Migrations
// ---------------------------------------------------------------------------

async function copyMigrations() {
  const target = join(CWD, 'supabase', 'migrations');
  const files = (await readdir(PACKAGE_MIGRATIONS)).filter((name) => name.endsWith('.sql')).sort();

  if (DRY_RUN) {
    planned(`create ${relative(CWD, target) || '.'}/`);
    for (const file of files) planned(`copy ${file}`);
    return;
  }

  await mkdir(target, { recursive: true });
  for (const file of files) {
    const destination = join(target, file);
    if (existsSync(destination)) {
      note(`${file} already there, left alone`);
      continue;
    }
    await copyFile(join(PACKAGE_MIGRATIONS, file), destination);
    note(`copied ${file}`);
  }
}

// ---------------------------------------------------------------------------
// 4. Environment variables
// ---------------------------------------------------------------------------

/** Parses just enough of a .env to know which keys already have a value. */
function parseEnv(text) {
  const values = {};
  for (const line of text.split('\n')) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/.exec(line);
    if (match) values[match[1]] = match[2].trim();
  }
  return values;
}

async function writeEnv(framework, values) {
  const path = join(CWD, framework.envFile);
  const existingText = existsSync(path) ? await readFile(path, 'utf8') : '';
  const existing = parseEnv(existingText);

  const additions = [];
  for (const [key, value] of Object.entries(values)) {
    if (!value) continue;
    if (existing[key]) {
      // Never clobber a value that is already there without being told to.
      const replace = await confirm(`${key} is already set. Replace it?`, false);
      if (!replace) {
        note(`${key} left as it is`);
        continue;
      }
    }
    additions.push([key, value]);
  }
  if (additions.length === 0) return;

  const block = additions.map(([key, value]) => `${key}=${value}`).join('\n');
  if (DRY_RUN) {
    planned(`append to ${framework.envFile}:`);
    for (const [key] of additions) console.log(`    ${dim(`${key}=…`)}`);
    return;
  }

  // Replacing means removing the old line, not leaving two.
  const keys = new Set(additions.map(([key]) => key));
  const kept = existingText
    .split('\n')
    .filter((line) => {
      const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(line);
      return !match || !keys.has(match[1]);
    })
    .join('\n')
    .replace(/\n+$/, '');

  await writeFile(path, `${kept ? `${kept}\n\n` : ''}# @askq/react\n${block}\n`, 'utf8');
  note(`wrote ${framework.envFile} (${additions.map(([key]) => key).join(', ')})`);

  if (!existsSync(join(CWD, '.gitignore'))) return;
  const gitignore = await readFile(join(CWD, '.gitignore'), 'utf8');
  if (!gitignore.split('\n').some((line) => line.trim() === framework.envFile)) {
    console.log(
      `\n  [33mWarning:[0m ${framework.envFile} is not in .gitignore. ` +
        'It now holds your service-role key — add it before committing.',
    );
  }
}

// ---------------------------------------------------------------------------
// 5. Supabase, local or hosted
// ---------------------------------------------------------------------------

async function setUpLocal() {
  if (!existsSync(join(CWD, 'supabase', 'config.toml'))) {
    if (run('supabase', ['init']).status !== 0) fail('`supabase init` failed.');
  } else {
    note('supabase/config.toml already there');
  }

  await copyMigrations();

  step('Starting the local stack (this pulls Docker images the first time)');
  if (run('supabase', ['start']).status !== 0) {
    fail('`supabase start` failed. Is Docker running?');
  }

  step('Applying migrations');
  if (run('supabase', ['db', 'reset']).status !== 0) {
    fail('`supabase db reset` failed — check the SQL in supabase/migrations.');
  }

  // `supabase status` knows the local URL and keys, so nothing has to be pasted.
  const status = run('supabase', ['status', '-o', 'json'], { capture: true });
  if (status.status !== 0) return {};
  try {
    const parsed = JSON.parse(status.stdout);
    return {
      url: parsed.API_URL,
      anonKey: parsed.ANON_KEY,
      serviceKey: parsed.SERVICE_ROLE_KEY,
    };
  } catch {
    return {};
  }
}

async function setUpHosted() {
  const ref = await ask('Supabase project ref (from the dashboard URL):');
  if (!ref && !DRY_RUN) fail('A project ref is needed to link a hosted project.');

  if (!existsSync(join(CWD, 'supabase', 'config.toml'))) {
    if (run('supabase', ['init']).status !== 0) fail('`supabase init` failed.');
  }

  await copyMigrations();

  step('Linking the project');
  if (run('supabase', ['link', '--project-ref', ref]).status !== 0) {
    fail('`supabase link` failed. Run `supabase login` first if you have not.');
  }

  step('Pushing migrations');
  if (run('supabase', ['db', 'push']).status !== 0) {
    fail('`supabase db push` failed — check the SQL in supabase/migrations.');
  }

  step('Keys');
  note('Project settings → API. The service-role key must never reach the browser.');
  return {
    url: await ask('Project URL:', DRY_RUN ? 'https://example.supabase.co' : ''),
    anonKey: await ask('Anon / publishable key:', DRY_RUN ? 'anon-key' : ''),
    serviceKey: await ask('Service-role key:', DRY_RUN ? 'service-key' : ''),
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(bold('\n@askq/react setup'));
  if (DRY_RUN) console.log(dim('  dry run — nothing will be changed\n'));

  step('Checking what is installed');
  checkNode();
  checkSupabaseCli();

  step('Detecting the framework');
  const detected = await detectFramework();
  let name = detected;
  if (detected) {
    note(`${FRAMEWORKS[detected].label}, from package.json`);
  } else {
    name = (await ask('Could not tell. next or astro?', 'astro')).toLowerCase();
  }
  const framework = FRAMEWORKS[name];
  if (!framework) fail(`Unsupported framework "${name}". This package targets Next.js and Astro.`);

  step('Choosing a database');
  let mode;
  if (flags.has('--local')) mode = 'local';
  else if (flags.has('--linked')) mode = 'hosted';
  else {
    const answer = await ask('Local Docker stack or a hosted project? (local/hosted)', 'hosted');
    mode = answer.toLowerCase().startsWith('l') ? 'local' : 'hosted';
  }
  note(mode === 'local' ? 'local Docker stack' : 'hosted project');

  const keys = mode === 'local' ? await setUpLocal() : await setUpHosted();

  if (!NO_ROUTE) {
    step('API route');
    const path = join(CWD, framework.routePath);
    if (existsSync(path)) {
      note(`${framework.routePath} already there, left alone`);
    } else if (await confirm(`Write ${framework.routePath}?`, true)) {
      if (DRY_RUN) {
        planned(`write ${framework.routePath}`);
      } else {
        await mkdir(dirname(path), { recursive: true });
        await writeFile(path, framework.route, 'utf8');
        note(`wrote ${framework.routePath}`);
      }
    }
  }

  if (!NO_ENV) {
    step('Environment variables');
    const wantsAuth = await confirm('Set a teacher username and password for the dashboard?', true);
    let teacher = {};
    if (wantsAuth) {
      const user = await ask('Teacher username:', 'teacher');
      const password = await ask('Teacher password:', DRY_RUN ? 'a-password' : '');
      if (user && password) {
        teacher = {
          ASKQ_TEACHER_USER: user,
          ASKQ_TEACHER_PASSWORD: password,
          // Generated rather than asked for: it is a signing key, not something
          // anyone should be inventing by hand.
          ASKQ_AUTH_SECRET: randomBytes(32).toString('base64'),
        };
      } else {
        // All three or none. Two out of three makes createTeacherAuth() throw,
        // which would look like a bug in the package rather than a half-answered
        // prompt.
        console.log(
          '\n  \u001b[33mWarning:\u001b[0m no teacher password given, so none of the auth ' +
            'variables were written. The dashboard is unprotected until you set ' +
            'ASKQ_TEACHER_USER, ASKQ_TEACHER_PASSWORD and ASKQ_AUTH_SECRET.',
        );
      }
    }

    await writeEnv(framework, {
      [framework.urlVar]: keys.url,
      [framework.keyVar]: keys.anonKey,
      SUPABASE_SERVICE_ROLE_KEY: keys.serviceKey,
      ...teacher,
    });
  }

  step('Next steps');
  console.log(`
  1. Write a question bank:

       // src/questions/lesson-one.ts
       import { defineGroup } from '@askq/react';

       export const lessonOne = defineGroup('lesson-1', {
         q1: { type: 'short-text', question: 'Capitale de la France ?', correctAnswer: ['Paris'] },
       });

  2. Configure once, at module scope, and import the bank so its questions register:

       import { configure } from '@askq/react';
       import '@askq/react/styles.css';
       import './questions/lesson-one';

       configure({
         supabaseUrl: ${framework.urlVar === 'PUBLIC_SUPABASE_URL' ? 'import.meta.env.PUBLIC_SUPABASE_URL' : 'process.env.NEXT_PUBLIC_SUPABASE_URL'},
         supabaseAnonKey: ${framework.keyVar === 'PUBLIC_SUPABASE_ANON_KEY' ? 'import.meta.env.PUBLIC_SUPABASE_ANON_KEY' : 'process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY'},
         readEndpoint: '/api/answers',
       });

  3. Ask:            <AskQuestion q={lessonOne.q1} />
  4. See answers:    <AnswerDashboard show="all" />   (from '@askq/react/dashboard')

  Protect the dashboard and /api/answers with createTeacherAuth() — see the
  README's "Manual setup" section for the middleware.
`);

  rl?.close();
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
