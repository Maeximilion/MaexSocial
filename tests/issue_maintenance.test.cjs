const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { runInNewContext } = require('node:vm');

const workflow = readFileSync(path.join(__dirname, '../.github/workflows/issue-maintenance.yml'), 'utf8').replace(/\r\n/g, '\n');
const blocks = workflow.split('          script: |\n');
assert.equal(blocks.length, 2);
const script = blocks[1].split('\n').map(line => line.replace(/^ {12}/, '')).join('\n');
const repo = { owner: 'Maeximilion', repo: 'MaexSocial' };
const repository = 'Maeximilion/MaexSocial';
const owner = { login: 'Maeximilion', type: 'User' };
const actions = { login: 'github-actions[bot]', type: 'Bot' };

function fixture(change = {}) {
  const task = { number: 7, node_id: 'I_7', state: 'open', title: 'Specific task', body: '', user: owner,
    labels: [{ name: 'type:ci' }, { name: 'gate:g0' }, { name: 'priority:p1' }, { name: 'area:github' }],
    milestone: { number: 2, title: 'G0 Foundation' }, assignees: [] };
  const pr = { number: 10, node_id: 'PR_10', state: 'open', title: 'chore(deps): update action', body: 'Refs #25',
    user: { login: 'dependabot[bot]', type: 'Bot' }, labels: [], milestone: null, assignees: [],
    head: { ref: 'dependabot/github_actions/checkout', repo: { full_name: repository } }, ...change };
  const issues = new Map([[7, task], [25, { ...structuredClone(task), number: 25, node_id: 'I_25', title: 'Aggregate maintenance' }]]);
  const prs = new Map([[10, pr]]);
  const closing = new Map([[10, new Set()]]);
  const writes = [];
  const reads = [];
  const getRecord = number => prs.get(number) || issues.get(number);
  const copy = value => structuredClone(value);
  const github = { rest: { issues: {}, pulls: {} } };
  github.rest.issues.get = async ({ issue_number }) => {
    assert.ok(getRecord(issue_number), `Unknown issue ${issue_number}`);
    return { data: copy(getRecord(issue_number)) };
  };
  github.rest.pulls.get = async ({ pull_number }) => ({ data: copy(prs.get(pull_number)) });
  github.rest.issues.addAssignees = async ({ issue_number, assignees }) => {
    writes.push(['assign', issue_number]);
    getRecord(issue_number).assignees = Array.from(assignees, login => ({ login }));
  };
  github.rest.issues.update = async ({ issue_number, milestone, ...rest }) => {
    assert.equal('body' in rest, false, 'Never rewrite PR bodies');
    writes.push(['milestone', issue_number, milestone]);
    getRecord(issue_number).milestone = { number: milestone };
  };
  github.rest.issues.addLabels = async ({ issue_number, labels }) => {
    writes.push(['labels', issue_number, Array.from(labels)]);
    getRecord(issue_number).labels.push(...Array.from(labels, name => ({ name })));
  };
  github.rest.issues.create = async args => {
    writes.push(['create', args.title]);
    const number = 100 + issues.size;
    const created = { number, node_id: `I_${number}`, state: 'open', user: actions,
      title: args.title, body: args.body, labels: Array.from(args.labels, name => ({ name })),
      assignees: Array.from(args.assignees, login => ({ login })), milestone: { number: args.milestone } };
    issues.set(number, created);
    return { data: copy(created) };
  };
  github.rest.pulls.list = function listPulls() {};
  github.rest.issues.listForRepo = function listIssues() {};
  github.rest.issues.listMilestones = function listMilestones() {};
  github.paginate = async (method, args) => {
    reads.push([method.name, args]);
    if (method === github.rest.pulls.list) return copy([...prs.values()].filter(p => p.state === 'open'));
    if (method === github.rest.issues.listForRepo) return copy([...issues.values()].filter(i => i.labels.some(l => l.name === 'dependencies')));
    if (method === github.rest.issues.listMilestones) return [{ number: 9, title: 'Maintenance', state: 'open' }];
    assert.fail('Unknown pagination route');
  };
  github.graphql = async (query, variables) => {
    if (query.includes('addCloseIssueReferences')) {
      const target = [...issues.values()].find(i => i.node_id === variables.issueId);
      assert.ok(target, 'Link only a known issue');
      assert.deepEqual(Array.from(variables.pullRequestIds), ['PR_10']);
      writes.push(['link', target.number]);
      closing.get(10).add(target.number);
      return { addCloseIssueReferences: { clientMutationId: null } };
    }
    assert.ok(query.includes('closingIssuesReferences'));
    const number = [...prs.values()].find(p => p.node_id === variables.id).number;
    return { node: { closingIssuesReferences: { nodes: [...closing.get(number)].map(n => ({
      id: issues.get(n).node_id, number: n, repository: { nameWithOwner: repository },
    })), pageInfo: { hasNextPage: false } } } };
  };
  async function run(eventName = 'pull_request_target', payload = { pull_request: pr }) {
    await runInNewContext(`(async () => {\n${script}\n})()`, {
      github, context: { repo, eventName, payload: copy(payload) }, core: { info() {} },
    });
  }
  return { run, issues, prs, pr, task, closing, writes, reads };
}

test('human task inheritance fills only missing metadata and never overwrites manual fields', async () => {
  const f = fixture({ user: owner, body: 'Refs #7', milestone: { number: 44 }, labels: [{ name: 'priority:p0' }] });
  f.task.labels.push({ name: 'dependencies' });
  await f.run();
  assert.equal(f.pr.milestone.number, 44);
  assert.deepEqual(f.pr.labels.map(l => l.name).sort(), ['area:github', 'dependencies', 'gate:g0', 'priority:p0', 'type:ci']);
  assert.equal(f.writes.some(w => ['create', 'link'].includes(w[0])), false);
});

test('dependency task creates and links once, preserves aggregate Refs and remains idempotent', async () => {
  const f = fixture();
  await f.run();
  const created = [...f.issues.values()].find(i => i.body.includes('<!-- maexsocial-dependency-pr:10 -->'));
  assert.ok(created);
  assert.deepEqual([...f.closing.get(10)], [created.number]);
  assert.equal(f.pr.body, 'Refs #25');
  assert.equal(f.pr.milestone.number, 9);
  assert.deepEqual(f.pr.labels.map(l => l.name).sort(), ['dependencies', 'priority:p2', 'type: chore']);
  assert.ok(created.labels.some(label => label.name === 'type: chore'));
  const count = f.writes.length;
  f.pr.body = 'Dependabot rewrote the body';
  await f.run();
  assert.equal(f.writes.length, count);
  assert.equal(f.issues.get(25).state, 'open');
});

test('existing explicit closing task is reused without creating a second dependency issue', async () => {
  const f = fixture({ body: 'Closes #7' });
  await f.run();
  assert.deepEqual([...f.closing.get(10)], [7]);
  assert.equal(f.writes.some(w => w[0] === 'create'), false);
  assert.equal(f.pr.milestone.number, 2);
});

test('existing trusted generated marker is reused after an interrupted link', async () => {
  const f = fixture();
  f.issues.set(40, { ...structuredClone(f.task), number: 40, node_id: 'I_40', user: actions,
    body: '<!-- maexsocial-dependency-pr:10 -->', labels: [{ name: 'dependencies' }] });
  await f.run();
  assert.deepEqual([...f.closing.get(10)], [40]);
  assert.equal(f.writes.some(w => w[0] === 'create'), false);
});

test('spoofed author and fork do not generate dependency tasks', async () => {
  for (const change of [
    { user: { login: 'dependabot[bot]', type: 'User' } },
    { head: { ref: 'dependabot/update', repo: { full_name: 'stranger/MaexSocial' } } },
  ]) {
    const f = fixture({ body: '', ...change });
    await f.run();
    assert.equal(f.writes.some(w => ['create', 'link'].includes(w[0])), false);
  }
});

test('source issue metadata event replays matching open PRs', async () => {
  const f = fixture({ user: owner, body: 'Refs #7' });
  await f.run('issues', { issue: f.task, action: 'labeled' });
  assert.equal(f.pr.milestone.number, 2);
  assert.ok(f.pr.labels.some(l => l.name === 'area:github'));
});

test('closed PR never creates a new task', async () => {
  const f = fixture({ state: 'closed' });
  await f.run();
  assert.equal(f.writes.length, 0);
});

test('manual replay handles all open PRs', async () => {
  const f = fixture();
  await f.run('workflow_dispatch', {});
  assert.equal(f.writes.filter(w => w[0] === 'create').length, 1);
});

test('unrelated source issue event creates no dependency task', async () => {
  const f = fixture();
  await f.run('issues', { issue: f.task, action: 'milestoned' });
  assert.equal(f.writes.some(w => ['create', 'link'].includes(w[0])), false);
});

test('untrusted generated marker does not capture a dependency PR', async () => {
  const f = fixture();
  f.issues.set(40, { ...structuredClone(f.task), number: 40, node_id: 'I_40',
    user: { login: 'outsider', type: 'User' }, body: '<!-- maexsocial-dependency-pr:10 -->',
    labels: [{ name: 'dependencies' }] });
  await f.run();
  assert.equal(f.closing.get(10).has(40), false);
  assert.equal(f.writes.filter(w => w[0] === 'create').length, 1);
});
