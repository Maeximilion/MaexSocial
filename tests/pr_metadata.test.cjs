const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { runInNewContext } = require('node:vm');

// Exercise the actual final inline workflow script, without a second validator.
const workflow = readFileSync(path.join(__dirname, '../.github/workflows/pr-metadata.yml'), 'utf8').replace(/\r\n/g, '\n');
const blocks = workflow.split('          script: |\n');
assert.equal(blocks.length, 2);
const script = blocks[1].split('\n').map(line => line.replace(/^ {12}/, '')).join('\n');

function validate(change = {}, actor = 'Maeximilion') {
  const pr = {
    title: 'chore(deps): update pinned action', body: '',
    user: { login: 'dependabot[bot]', type: 'Bot' },
    head: { ref: 'dependabot/github_actions/actions/checkout-7.0.1', repo: { full_name: 'Maeximilion/MaexSocial' } },
    ...change,
  };
  const errors = [];
  runInNewContext(script, {
    context: { actor, repo: { owner: 'Maeximilion', repo: 'MaexSocial' }, payload: { pull_request: pr } },
    core: { setFailed: message => errors.push(message) },
  });
  return errors;
}

const human = { login: 'contributor', type: 'User' };
test('trusted same-repository Dependabot PR is its own maintenance task', () => {
  assert.deepEqual(validate(), []);
});
test('human PR with partial task reference passes', () => {
  assert.deepEqual(validate({ user: human, body: 'Refs #29' }), []);
});
test('human PR without a task reference fails', () => {
  assert.equal(validate({ user: human }).length, 1);
});
test('bot-like login without Bot identity cannot bypass the task link', () => {
  assert.equal(validate({ user: { login: 'dependabot[bot]', type: 'User' } }).length, 1);
});
test('Dependabot PR from a fork still requires a task reference', () => {
  assert.equal(validate({ head: { ref: 'dependabot/upgrade', repo: { full_name: 'other/MaexSocial' } } }).length, 1);
});
test('unrecognized branch does not receive the maintenance exception', () => {
  assert.equal(validate({ head: { ref: 'feature/admin', repo: { full_name: 'Maeximilion/MaexSocial' } } }).length, 1);
});
test('event actor cannot grant the author a bot exception', () => {
  assert.equal(validate({ user: human }, 'dependabot[bot]').length, 1);
});
test('missing source repository fails closed', () => {
  assert.equal(validate({ head: { ref: 'dependabot/upgrade', repo: null } }).length, 1);
});
test('Dependabot must still use a valid Conventional Commit title', () => {
  assert.equal(validate({ title: 'update dependency' }).length, 1);
});
