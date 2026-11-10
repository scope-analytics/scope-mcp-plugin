#!/usr/bin/env node
// Runs Scope's CLI (@scope-analytics/cli) for this plugin's hooks and monitor, in the project's
// folder, and only for a project linked to Scope: with no Scope key there, it exits at once and
// prints nothing, so a project without Scope never pays for the plugin.
//
//   node scope.mjs hook session-start --format auto|claude-code|codex|cursor
//   node scope.mjs hook prompt --format auto
//   node scope.mjs listen
//
// SCOPE_CLI=/path/to/cli/bin/scope.js runs a local copy of the CLI instead of the published one
// (for trying a branch). A hook never fails the coding agent's session: it always exits 0.
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const CLI_PACKAGE = '@scope-analytics/cli@^0.2.0';
const ENV_FILES = ['.env.local', '.env'];

// Hook input on stdin (JSON), when there is some: Claude Code and Codex send `cwd`, Cursor sends
// `workspace_roots`. A monitor has no input, so stdin is only read for a hook, and not for long.
function readHookInput(quietMs = 300) {
  if (process.stdin.isTTY) return Promise.resolve({});
  return new Promise((resolve) => {
    let text = '';
    const done = () => {
      clearTimeout(timer);
      process.stdin.removeAllListeners('data');
      process.stdin.pause();
      try {
        resolve(text.trim() ? JSON.parse(text) : {});
      } catch {
        resolve({});
      }
    };
    let timer = setTimeout(done, quietMs);
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      text += chunk;
      clearTimeout(timer);
      timer = setTimeout(done, quietMs);
    });
    process.stdin.once('end', done);
    process.stdin.once('error', done);
  });
}

function hasKey(dir) {
  for (const name of ENV_FILES) {
    try {
      if (/^\s*(?:export\s+)?SCOPE_API_KEY\s*=\s*\S/m.test(readFileSync(join(dir, name), 'utf8'))) return true;
    } catch {
      // no such file
    }
  }
  return false;
}

// The project's folder: the first candidate with a Scope key in its env files (the CLI reads the
// key there), or the first candidate at all when SCOPE_API_KEY is set in the environment.
export function projectDir(input, env = process.env, cwd = process.cwd()) {
  const candidates = [input.cwd, env.CLAUDE_PROJECT_DIR, env.CURSOR_PROJECT_DIR, ...(input.workspace_roots || []), cwd]
    .filter((d) => typeof d === 'string' && d && existsSync(d));
  const unique = [...new Set(candidates)];
  if (env.SCOPE_API_KEY && env.SCOPE_API_KEY.trim()) return unique[0] || cwd;
  return unique.find(hasKey) || null;
}

// Which agent runs this hook: Cursor and Codex name their plugin roots their own way.
export function agentFormat(env = process.env) {
  if (env.CURSOR_PLUGIN_ROOT) return 'cursor';
  if (env.PLUGIN_ROOT) return 'codex';
  return 'claude-code';
}

async function main(argv) {
  const isHook = argv[0] === 'hook';
  // Claude Code's monitor brings what arrives mid-session; its prompt hook is there for Codex, which
  // shares this hooks file, so in Claude Code it ends here without starting the CLI.
  const format = argv[argv.indexOf('--format') + 1];
  if (isHook && argv[1] === 'prompt' && format === 'auto' && agentFormat() === 'claude-code') return 0;
  const input = isHook ? await readHookInput() : {};
  const dir = projectDir(input);
  if (!dir) return 0;
  const args = argv.map((a, i) => (a === 'auto' && argv[i - 1] === '--format' ? agentFormat() : a));
  const local = process.env.SCOPE_CLI;
  const [cmd, cmdArgs] = local
    ? [process.execPath, [local, ...args]]
    : [process.platform === 'win32' ? 'npx.cmd' : 'npx', ['-y', CLI_PACKAGE, ...args]];
  const code = await new Promise((resolve) => {
    const child = spawn(cmd, cmdArgs, { cwd: dir, stdio: ['ignore', 'inherit', 'inherit'], shell: process.platform === 'win32' && !local });
    child.on('error', () => resolve(isHook ? 0 : 1));
    child.on('exit', (c) => resolve(c ?? 0));
    for (const sig of ['SIGTERM', 'SIGINT']) process.once(sig, () => child.kill(sig));
  });
  return isHook ? 0 : code;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    () => process.exit(process.argv[2] === 'hook' ? 0 : 1)
  );
}
