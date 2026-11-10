// node --test scope-analytics-mcp/scripts/  — the wrapper the hooks and the monitor run.
import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { agentFormat, projectDir } from './scope.mjs';

const here = fileURLToPath(new URL('.', import.meta.url));
const WRAPPER = join(here, 'scope.mjs');
const PLUGIN = join(here, '..');

function dirs() {
  const linked = mkdtempSync(join(tmpdir(), 'scope-plugin-linked-'));
  const plain = mkdtempSync(join(tmpdir(), 'scope-plugin-plain-'));
  writeFileSync(join(linked, '.env.local'), 'OTHER=1\nSCOPE_API_KEY=sk_member\n');
  return { linked, plain, done: () => [linked, plain].forEach((d) => rmSync(d, { recursive: true, force: true })) };
}

test('the project folder is the first candidate that has a Scope key', () => {
  const d = dirs();
  try {
    assert.equal(projectDir({ cwd: d.linked }, {}, d.plain), d.linked);
    assert.equal(projectDir({}, { CLAUDE_PROJECT_DIR: d.linked }, d.plain), d.linked);
    assert.equal(projectDir({}, { CURSOR_PROJECT_DIR: d.linked }, d.plain), d.linked);
    assert.equal(projectDir({ workspace_roots: [d.plain, d.linked] }, {}, d.plain), d.linked);
    assert.equal(projectDir({ cwd: d.plain }, {}, d.plain), null, 'no key anywhere: nothing to do');
    assert.equal(projectDir({ cwd: d.plain }, { SCOPE_API_KEY: 'sk_x' }, d.linked), d.plain, 'a key in the environment works anywhere');
    assert.equal(projectDir({ cwd: '/no/such/dir' }, {}, d.linked), d.linked);
    writeFileSync(join(d.plain, '.env'), 'SCOPE_API_KEY=\n');
    assert.equal(projectDir({ cwd: d.plain }, {}, d.plain), null, 'an empty key line is no key');
  } finally {
    d.done();
  }
});

test('auto format: Cursor and Codex by their own plugin-root variables, else Claude Code', () => {
  assert.equal(agentFormat({ CLAUDE_PLUGIN_ROOT: '/p' }), 'claude-code');
  assert.equal(agentFormat({ PLUGIN_ROOT: '/p', CLAUDE_PLUGIN_ROOT: '/p' }), 'codex');
  assert.equal(agentFormat({ CURSOR_PLUGIN_ROOT: '/p' }), 'cursor');
});

test('a project without Scope: the hook and the monitor exit at once and print nothing', () => {
  const d = dirs();
  try {
    for (const args of [['hook', 'session-start', '--format', 'auto'], ['hook', 'prompt', '--format', 'auto'], ['listen']]) {
      const env = { PATH: process.env.PATH, HOME: process.env.HOME, SCOPE_CLI: '/nonexistent/scope.js' };
      const r = spawnSync(process.execPath, [WRAPPER, ...args], { cwd: d.plain, env, input: JSON.stringify({ cwd: d.plain }), encoding: 'utf8', timeout: 10000 });
      assert.equal(r.status, 0, args.join(' '));
      assert.equal(r.stdout, '', args.join(' '));
    }
  } finally {
    d.done();
  }
});

test("Claude Code's prompt hook ends before starting the CLI (its monitor covers mid-session)", () => {
  const d = dirs();
  try {
    const marker = join(d.plain, 'ran');
    writeFileSync(join(d.plain, 'fake-cli.mjs'), `import { writeFileSync } from 'node:fs'; writeFileSync(${JSON.stringify(marker)}, 'x');`);
    const env = { PATH: process.env.PATH, HOME: process.env.HOME, SCOPE_CLI: join(d.plain, 'fake-cli.mjs') };
    const run = (extra) => spawnSync(process.execPath, [WRAPPER, 'hook', 'prompt', '--format', 'auto'], { env: { ...env, ...extra }, input: JSON.stringify({ cwd: d.linked }), encoding: 'utf8', timeout: 10000 });
    assert.equal(run({}).status, 0);
    assert.throws(() => readFileSync(marker), 'the CLI did not run for Claude Code');
    assert.equal(run({ PLUGIN_ROOT: '/codex/plugin' }).status, 0);
    assert.equal(readFileSync(marker, 'utf8'), 'x', 'Codex still runs it');
  } finally {
    d.done();
  }
});

test('the CLI is pinned to an exact version and learns the wrapper\'s pid', () => {
  const src = readFileSync(WRAPPER, 'utf8');
  assert.match(src, /const CLI_PACKAGE = '@scope-analytics\/cli@\d+\.\d+\.\d+';/);
  const d = dirs();
  try {
    const out = join(d.plain, 'env.json');
    writeFileSync(join(d.plain, 'fake-cli.mjs'), `import { writeFileSync } from 'node:fs'; writeFileSync(${JSON.stringify(out)}, JSON.stringify({ pid: process.env.SCOPE_WATCH_PID, ppid: process.ppid }));`);
    const env = { PATH: process.env.PATH, HOME: process.env.HOME, SCOPE_CLI: join(d.plain, 'fake-cli.mjs') };
    const r = spawnSync(process.execPath, [WRAPPER, 'listen'], { cwd: d.linked, env, encoding: 'utf8', timeout: 10000 });
    assert.equal(r.status, 0);
    const seen = JSON.parse(readFileSync(out, 'utf8'));
    assert.equal(seen.pid, String(seen.ppid), 'SCOPE_WATCH_PID is the wrapper');
  } finally {
    d.done();
  }
});

test('a hook always exits 0, even when the CLI cannot run', () => {
  const d = dirs();
  try {
    const env = { PATH: process.env.PATH, HOME: process.env.HOME, SCOPE_CLI: '/nonexistent/scope.js' };
    const r = spawnSync(process.execPath, [WRAPPER, 'hook', 'session-start', '--format', 'auto'], { env, input: JSON.stringify({ cwd: d.linked }), encoding: 'utf8', timeout: 10000 });
    assert.equal(r.status, 0);
  } finally {
    d.done();
  }
});

test('the manifests point at files that exist, and every hook and monitor runs this wrapper', () => {
  const read = (p) => JSON.parse(readFileSync(join(PLUGIN, p), 'utf8'));
  const claude = read('hooks/hooks.json').hooks;
  assert.deepEqual(Object.keys(claude).sort(), ['SessionStart', 'UserPromptSubmit']);
  for (const entries of Object.values(claude)) {
    for (const h of entries.flatMap((e) => e.hooks)) assert.match(h.command, /^node "\$\{CLAUDE_PLUGIN_ROOT\}\/scripts\/scope\.mjs" hook (session-start|prompt) --format auto$/);
  }
  const cursor = read('hooks/cursor-hooks.json');
  assert.equal(cursor.hooks.sessionStart[0].command, 'node ./scripts/scope.mjs hook session-start --format cursor');
  const monitors = read('monitors/monitors.json');
  assert.equal(monitors.length, 1);
  assert.match(monitors[0].command, /scripts\/scope\.mjs" listen$/);
  for (const m of monitors) assert.deepEqual(Object.keys(m).sort(), ['command', 'description', 'name']);
  const cursorManifest = read('.cursor-plugin/plugin.json');
  readFileSync(join(PLUGIN, cursorManifest.hooks));
  readFileSync(join(PLUGIN, cursorManifest.mcpServers));
  const claudeManifest = read('.claude-plugin/plugin.json');
  assert.equal(cursorManifest.version, claudeManifest.version);
  readFileSync(join(PLUGIN, 'skills/scope-teammate/SKILL.md'));
});
