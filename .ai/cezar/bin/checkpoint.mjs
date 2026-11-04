#!/usr/bin/env node
// Checkpoint for the goal workflow (.ai/cezar/workflows/goal.yaml).
//
// Called by Cezar check nodes between agent steps, in the task's worktree. It:
//   1. commits the work in progress and pushes the task branch, so nothing is lost if the run stops
//      (subscription limit, reboot); it refuses to push when the branch holds files that look like
//      secrets or scans (the repository is public);
//   2. records the step in ~/.mcr-conductor/progress/run-<run id>.json, which the conductor mirrors
//      to the board and uses to resume stopped runs;
//   3. copies .ai/run/*.md (plan, test report, review) next to it, for the issue comments.
//
// It always exits 0: reporting must never fail the workflow.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const step = process.argv[2] ?? 'unknown';
const stateDir = process.env.CONDUCTOR_STATE_DIR || path.join(os.homedir(), '.mcr-conductor');
const runId = process.env.CEZ_RUN_ID ?? null; // set by Cezar for check steps
const base = process.env.CEZ_BASE || 'main';

// Never pushed: env files (except examples), keys and certificates, scanned documents.
const FORBIDDEN = [
  /(^|\/)\.env(\.(?!example$)[^/]+)?$/,
  /\.(pem|key|p12|pfx|jks|keystore)$/i,
  /(^|\/)id_(rsa|ed25519|ecdsa)(\.pub)?$/,
  /\.scan\.pdf$/i,
  /(^|\/)scans\//,
];

const git = (...args) =>
  execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

function attempt(label, fn, fallback = null) {
  try {
    return fn();
  } catch (err) {
    console.error(`[checkpoint] ${label} failed: ${String(err.message || err).split('\n')[0]}`);
    return fallback;
  }
}

const branch =
  process.env.CEZ_BRANCH ||
  attempt('read branch', () => git('symbolic-ref', '--short', 'HEAD'), null) ||
  attempt('read branch', () => git('rev-parse', '--abbrev-ref', 'HEAD'), 'unknown');
const key = runId ? `run-${runId}` : branch.replace(/[^A-Za-z0-9._-]/g, '_');

// 1. Save the work in progress (.ai/run/ is ignored by .ai/.gitignore).
attempt('commit', () => {
  git('add', '-A');
  const staged = git('diff', '--cached', '--name-only').split('\n').filter(Boolean);
  const unsafe = staged.filter((file) => FORBIDDEN.some((re) => re.test(file)));
  if (unsafe.length) git('reset', '-q', '--', ...unsafe); // leave them out of the commit
  if (git('diff', '--cached', '--name-only')) git('commit', '--no-verify', '-m', `wip(agent): after ${step}`);
});
const commit = attempt('read commit', () => git('rev-parse', '--short', 'HEAD'));

// Cezar also commits at the end of each agent turn: check everything the branch adds, not only ours.
let baseRef = base;
try {
  git('rev-parse', '--verify', '-q', `origin/${base}`);
  baseRef = `origin/${base}`;
} catch {
  // no remote-tracking branch: compare with the local base
}
const added = attempt('list branch files', () => git('diff', '--name-only', `${baseRef}...HEAD`).split('\n'), []);
const pushBlocked = added.filter((file) => file && FORBIDDEN.some((re) => re.test(file)));
if (pushBlocked.length) {
  console.error(`[checkpoint] NOT pushing: the branch contains ${pushBlocked.join(', ')}`);
} else {
  attempt('push', () => git('push', '--no-verify', '-u', 'origin', 'HEAD'));
}

// 2. Record the step.
const progressDir = path.join(stateDir, 'progress');
const file = path.join(progressDir, `${key}.json`);
attempt('write progress', () => {
  fs.mkdirSync(progressDir, { recursive: true });
  const previous = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : { history: [] };
  const at = new Date().toISOString();
  const history = [...(previous.history ?? []), { step, at, commit }];
  const progress = {
    runId,
    branch,
    worktree: process.cwd(),
    step,
    at,
    commit,
    reworkCycles: history.filter((h) => h.step === 'fix').length,
    pushBlocked: pushBlocked.length ? pushBlocked : undefined,
    history,
  };
  fs.writeFileSync(file, JSON.stringify(progress, null, 2));
});

// 3. Keep the run notes for the issue comments.
attempt('copy run notes', () => {
  const runDir = path.join(process.cwd(), '.ai', 'run');
  if (!fs.existsSync(runDir)) return;
  const target = path.join(stateDir, 'artifacts', key);
  fs.mkdirSync(target, { recursive: true });
  for (const name of fs.readdirSync(runDir)) {
    if (name.endsWith('.md')) fs.copyFileSync(path.join(runDir, name), path.join(target, name));
  }
});

console.log(`[checkpoint] ${step} recorded on ${branch}${commit ? ` at ${commit}` : ''}`);
process.exit(0);
