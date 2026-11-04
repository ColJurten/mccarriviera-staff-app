#!/usr/bin/env node
// First step of the goal workflow (.ai/cezar/workflows/goal.yaml).
//
// When the conductor restarts a ticket from its last checkpoint, it starts a new run whose task
// ends with two lines:
//   Resume-From: <branch of the previous run>
//   Resume-Run: <id of the previous run>
// This step then puts the previous run's work on the new branch (the local branch first, which
// also holds Cezar's end-of-turn commits, else the pushed one), and brings back its notes
// (.ai/run/plan.md, test-report.md, review.md), so the agents carry on instead of starting over.
// A task without those lines is a fresh run: nothing to do.
//
// It fails the run (exit 1) only when the previous work can't be brought back, so that a
// restarted run never silently starts again from main.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const stateDir = process.env.CONDUCTOR_STATE_DIR || path.join(os.homedir(), '.mcr-conductor');
const runId = process.env.CEZ_RUN_ID;
const api = (process.env.CEZ_API_URL || 'http://127.0.0.1:4321').replace(/\/$/, '');
const scope = process.env.CEZ_PROJECT_ID ? `/p/${encodeURIComponent(process.env.CEZ_PROJECT_ID)}` : '';

const git = (...args) =>
  execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const fail = (message) => {
  console.error(`[resume] ${message}`);
  process.exit(1);
};

if (!runId) {
  console.log('[resume] no CEZ_RUN_ID: fresh run');
  process.exit(0);
}

let task = '';
try {
  const res = await fetch(`${api}/api/v1${scope}/runs/${encodeURIComponent(runId)}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  task = (await res.json()).task ?? '';
} catch (err) {
  fail(`can't read this run's task from Cezar at ${api}: ${err.message}`);
}

const from = /^Resume-From:\s*(\S+)\s*$/m.exec(task)?.[1];
const previousRun = /^Resume-Run:\s*(\S+)\s*$/m.exec(task)?.[1];
if (!from) {
  console.log('[resume] fresh run');
  process.exit(0);
}
if (!/^[A-Za-z0-9._/-]+$/.test(from) || from.startsWith('-')) fail(`invalid branch name: ${from}`);

// 1. The previous work: local branch (same repository, so it is visible from this worktree), else origin.
let source = null;
try {
  git('rev-parse', '--verify', '-q', `refs/heads/${from}`);
  source = `refs/heads/${from}`;
} catch {
  try {
    git('fetch', '--quiet', 'origin', `refs/heads/${from}`);
    source = 'FETCH_HEAD';
  } catch {
    source = null;
  }
}
if (source) {
  git('reset', '--hard', source);
  console.log(`[resume] carried on from ${from} at ${git('rev-parse', '--short', 'HEAD')}`);
} else {
  console.log(`[resume] ${from} has no commits anywhere: starting from the base branch`);
}

// 2. The previous notes and progress history.
const runDir = path.join(process.cwd(), '.ai', 'run');
fs.mkdirSync(runDir, { recursive: true });
const keys = [previousRun && `run-${previousRun}`, from.replace(/[^A-Za-z0-9._-]/g, '_')].filter(Boolean);
for (const key of keys) {
  const dir = path.join(stateDir, 'artifacts', key);
  if (!fs.existsSync(dir)) continue;
  for (const name of fs.readdirSync(dir)) {
    if (name.endsWith('.md')) fs.copyFileSync(path.join(dir, name), path.join(runDir, name));
  }
  console.log(`[resume] notes restored from ${key}`);
  break;
}
fs.appendFileSync(
  path.join(runDir, 'plan.md'),
  `\n\n## Resumed\n\nRestarted ${new Date().toISOString()} from \`${from}\`. Part of this plan may already be done: check the code before redoing anything.\n`,
);
for (const key of keys) {
  const file = path.join(stateDir, 'progress', `${key}.json`);
  if (!fs.existsSync(file)) continue;
  const previous = JSON.parse(fs.readFileSync(file, 'utf8'));
  const target = path.join(stateDir, 'progress', `run-${runId}.json`);
  const history = [...(previous.history ?? []), { step: 'resume', at: new Date().toISOString(), from }];
  fs.writeFileSync(
    target,
    JSON.stringify({ ...previous, runId, step: 'resume', history, pushBlocked: undefined }, null, 2),
  );
  break;
}
process.exit(0);
