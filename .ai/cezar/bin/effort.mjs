#!/usr/bin/env node
// Effort step of the goal workflow (.ai/cezar/workflows/goal.yaml):
//   node .ai/cezar/bin/effort.mjs <codex|claude> <level>
// Writes the reasoning effort of the next agent step to .ai/run/effort-<runner> in the task's
// worktree (.ai/run/ is never committed). The launchers codex-effort and claude-effort read it when
// Cezar starts the CLI for that step.
// Fails (exit 1) on an unknown runner or level, so a typo stops the run instead of silently running
// at another effort.
import fs from 'node:fs';
import path from 'node:path';

const LEVELS = {
  codex: ['low', 'medium', 'high', 'xhigh', 'max', 'ultra'],
  claude: ['low', 'medium', 'high', 'xhigh', 'max'],
};

const [runner, level] = process.argv.slice(2);
if (!LEVELS[runner] || !LEVELS[runner].includes(level)) {
  console.error(
    `[effort] usage: effort.mjs <codex|claude> <level>; got "${runner ?? ''}" "${level ?? ''}". ` +
      `Levels: codex ${LEVELS.codex.join('/')}, claude ${LEVELS.claude.join('/')}.`,
  );
  process.exit(1);
}

const runDir = path.join(process.cwd(), '.ai', 'run');
fs.mkdirSync(runDir, { recursive: true });
fs.writeFileSync(path.join(runDir, `effort-${runner}`), `${level}\n`);
console.log(`[effort] next ${runner} step: ${level}`);
