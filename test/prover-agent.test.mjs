// Oracle for unit: agents/hyperworkflows-prover.md
//
// The unit is a Claude Code subagent definition (YAML frontmatter + role-contract
// body). There is no runtime "output" distinct from the source, so a golden/snapshot
// oracle would be circular. Instead this is a PROPERTY-BASED oracle: it asserts the
// invariants the Claude Code agent loader and this repo's conventions actually enforce.
// Each property, if violated, is a real defect class (agent fails to load, is granted
// an unknown tool, targets an unknown model, or drops its role contract).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, basename } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const AGENT_PATH = resolve(HERE, '..', 'agents', 'hyperworkflows-prover.md');

// Tool vocabulary is the set actually used across this repo's agents, which are the
// real Claude Code tool names. Model vocabulary is Claude Code's tier aliases.
const KNOWN_TOOLS = new Set(['Bash', 'Read', 'Edit', 'Write', 'Grep', 'Glob']);
const KNOWN_MODELS = new Set(['opus', 'sonnet', 'haiku']);
const KNOWN_ISOLATION = new Set(['worktree']);

function parseFrontmatter(text) {
  // Frontmatter is delimited by a leading `---` line and the next `---` line.
  const lines = text.split('\n');
  assert.equal(lines[0], '---', 'file must open with a `---` frontmatter fence');
  let close = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === '---') { close = i; break; }
  }
  assert.ok(close > 0, 'frontmatter must be closed with a `---` fence');
  const fm = {};
  for (let i = 1; i < close; i++) {
    const line = lines[i];
    if (line.trim() === '') continue;
    const idx = line.indexOf(':');
    assert.ok(idx > 0, `malformed frontmatter line: ${JSON.stringify(line)}`);
    const key = line.slice(0, idx).trim();
    const val = line.slice(idx + 1).trim();
    fm[key] = val;
  }
  const body = lines.slice(close + 1).join('\n');
  return { fm, body };
}

const raw = readFileSync(AGENT_PATH, 'utf8');
const { fm, body } = parseFrontmatter(raw);

test('name equals the filename stem (loader identity invariant)', () => {
  const stem = basename(AGENT_PATH).replace(/\.md$/, '');
  assert.equal(fm.name, stem);
});

test('description is present and non-trivial', () => {
  assert.ok(fm.description, 'description key is required');
  assert.ok(fm.description.length >= 20, 'description must be substantive');
});

test('model is a recognized Claude Code tier', () => {
  assert.ok(fm.model, 'model key is required');
  assert.ok(KNOWN_MODELS.has(fm.model), `unknown model: ${fm.model}`);
});

test('every declared tool is a known Claude Code tool', () => {
  assert.ok(fm.tools, 'prover declares a tools allowlist');
  const tools = fm.tools.split(',').map((t) => t.trim()).filter(Boolean);
  assert.ok(tools.length > 0, 'tools list is non-empty');
  for (const t of tools) {
    assert.ok(KNOWN_TOOLS.has(t), `unknown tool declared: ${t}`);
  }
});

test('prover is read/measure-only: no mutating tools granted', () => {
  const tools = (fm.tools || '').split(',').map((t) => t.trim()).filter(Boolean);
  // The role contract states "You never fix tests or code; you measure their
  // strength and report." A prover granted Edit/Write would contradict that.
  assert.ok(!tools.includes('Edit'), 'prover must not be granted Edit');
  assert.ok(!tools.includes('Write'), 'prover must not be granted Write');
});

test('isolation, if declared, is a recognized mode', () => {
  if (fm.isolation !== undefined) {
    assert.ok(KNOWN_ISOLATION.has(fm.isolation), `unknown isolation: ${fm.isolation}`);
  }
});

test('body carries a ROLE CONTRACT and the never-fix invariant', () => {
  assert.match(body, /ROLE CONTRACT/, 'body must state the role contract');
  assert.match(body, /never fix tests or code/i, 'body must state measure-only invariant');
});
