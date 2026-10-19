// Runs every source fetch, then the optional summarizer.
// News has to succeed. A later source (papers, reviews, Reddit) must not
// discard a fresh news file by failing the whole command before the
// workflow can commit public/data.
// News gets 90s. Each optional step gets 60s. A step that runs past its
// limit is killed so one hung source cannot stall the workflow.

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));

export const REQUIRED_TIMEOUT_MS = 90_000;
export const OPTIONAL_TIMEOUT_MS = 60_000;
const TERM_GRACE_MS = 3_000;
const KILL_GRACE_MS = 2_000;

export const steps = [
  { script: 'fetch-news.js', required: true },
  { script: 'fetch-papers.js', required: false },
  { script: 'fetch-reviews.js', required: false },
  { script: 'fetch-reddit.js', required: false },
  { script: 'summarize.js', required: false },
];

function formatDuration(ms) {
  return `${(ms / 1000).toFixed(1)}s`;
}

function killChild(child, signal) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  try {
    child.kill(signal);
  } catch {
    // The process already exited.
  }
}

export function runStep(step) {
  const script = step.script;
  const file = step.file || path.join(dir, script);
  const timeoutMs = Number.isFinite(step.timeoutMs)
    ? step.timeoutMs
    : (step.required ? REQUIRED_TIMEOUT_MS : OPTIONAL_TIMEOUT_MS);

  return new Promise((resolve) => {
    const started = Date.now();
    console.log(`[fetch-all] start ${script}`);
    const child = spawn(process.execPath, [file], { stdio: 'inherit' });
    let timedOut = false;
    let finished = false;
    let timeoutTimer;
    let termTimer;
    let killTimer;

    const finish = (code) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeoutTimer);
      clearTimeout(termTimer);
      clearTimeout(killTimer);
      if (!timedOut && code !== 0) {
        console.error(`[fetch-all] ${script} exited ${code}`);
      }
      const duration = formatDuration(Date.now() - started);
      console.log(`[fetch-all] end ${script} in ${duration}`);
      resolve({ code, timedOut });
    };

    timeoutTimer = setTimeout(() => {
      timedOut = true;
      console.error(`[fetch-all] ${script} timed out`);
      killChild(child, 'SIGTERM');
      termTimer = setTimeout(() => {
        killChild(child, 'SIGKILL');
        killTimer = setTimeout(() => finish(124), KILL_GRACE_MS);
      }, TERM_GRACE_MS);
    }, timeoutMs);

    child.on('exit', (code) => {
      finish(timedOut ? 124 : (code ?? 1));
    });
    child.on('error', () => {
      finish(1);
    });
  });
}

export async function runAll(list = steps) {
  let failed = false;
  for (const step of list) {
    const result = await runStep(step);
    if ((result.timedOut || result.code !== 0) && step.required) failed = true;
  }
  return failed;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const failed = await runAll();
  process.exit(failed ? 1 : 0);
}
