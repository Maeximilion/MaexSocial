import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { lstat, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { capture, verifyPair, type Pair } from '../../ops/local/backup.js';
import { loadBackupKey } from '../../ops/local/backup-crypto.js';
import { compose, connectFixture, loadFixture, runIsolatedFixture, type Fixture } from '../../ops/local/fixture.js';
import { eraseCustomer } from '../../ops/local/customer-erasure.js';
import { restore } from '../../ops/local/restore.js';
import { applySourceCustomerErasure } from '../../ops/local/source-customer-erasure.js';
import { authorizeCase, exerciseSource, inspectCase, seedCase, type AccessCase } from './customer-erasure-case.js';

const input = 'work/customer-erasure-case.json';
const script = 'dist/pilot/tests/pilot/customer-erasure-drill.js';
const historyPath = 'work/pilot/restore-history.json';
const sha = (bytes: string) => createHash('sha256').update(bytes).digest('hex');
async function stage(name: string) {
  const f = await loadFixture();
  assert.ok(f.purpose === 'backup' || f.pairedRestore);
  const db = await connectFixture(true);
  try {
    if (name === 'seed' && f.purpose === 'backup' && !f.restoreTarget) return await seedCase(db,f.id);
    const c = JSON.parse(await readFile(input,'utf8')) as AccessCase;
    if (name === 'before' || name === 'after') return await inspectCase(db,c,name === 'after',!!f.pairedRestore);
    assert.ok(name === 'erase' && f.purpose === 'backup' && !f.restoreTarget);
    const before = await inspectCase(db,c,false,false);
    await assert.rejects(applySourceCustomerErasure,/instruction required/);
    const digest = sha(await readFile(historyPath,'utf8'));
    const authorized = await authorizeCase(db,f.id,c,digest);
    for (const [column,wrong,original] of [
      ['fixture_id',randomUUID(),f.id],['subject_binding','0'.repeat(64),c.event.binding],
      ['identity_version',c.event.version-1,c.event.version],['identity_id',c.peerId,c.event.id],
      ['history_digest','0'.repeat(64),digest],
    ] as const) {
      await db.query(`UPDATE pilot.fixture_customer_erasure SET ${column}=$1`,[wrong]);
      try { await assert.rejects(applySourceCustomerErasure,/instruction required|scope mismatch|restore history/); }
      finally { await db.query(`UPDATE pilot.fixture_customer_erasure SET ${column}=$1`,[original]); }
      assert.equal(await inspectCase(db,c,false,false),before);
    }
    for (const mode of ['changed subject','management grant']) {
      await db.query('BEGIN');
      try {
        if (mode === 'changed subject') {
          await db.query('UPDATE pilot.identities SET subject=$2,version=version+1 WHERE id=$1',[c.event.id,'changed-fixture-subject']);
          await assert.rejects(eraseCustomer(db,f.id,{...c.event,version:c.event.version+1},false),/binding mismatch/);
        } else {
          await db.query('INSERT INTO pilot.platform_grants(identity_id) VALUES($1)',[c.event.id]);
          await assert.rejects(eraseCustomer(db,f.id,c.event,false),/Customer-only/);
        }
      } finally { await db.query('ROLLBACK'); }
    }
    const confirmed=await exerciseSource(db,c);
    assert.ok(confirmed>=authorized);
    return { authorized:authorized.toISOString(), confirmed:confirmed.toISOString() };
  } finally { await db.end(); }
}

async function drill() {
  const fixtureDir = 'work/pilot', sourceDir = resolve('work/customer-erasure-source');
  for (const path of [fixtureDir,sourceDir,input]) await assert.rejects(lstat(path), {code:'ENOENT'});
  await loadBackupKey();
  await mkdir('work',{recursive:true});
  const run = (f: Fixture, name: string) => {
    try { return JSON.parse(runIsolatedFixture(f,[script,name]).output); }
    catch (error) {
      const location = String(error).match(/Customer erasure drill failed \([^)]+\)/)?.[0];
      console.error('Fixture stage failed: '+name+(location ? ' '+location : ''));
      throw error;
    }
  };
  let owned: Fixture | undefined;
  let c!: AccessCase;
  try {
    await capture(true,f => { owned=f; c=run(f,'seed'); });
    const f=await loadFixture();
    const pairBytes=await readFile(fixtureDir+'/cold-backup/pair.json','utf8');
    const pair=JSON.parse(pairBytes) as Pair;
    assert.ok(pair.historyAnchor && pair.format===3 && pair.disposable && pair.lineageCapturedAt===pair.capturedAt);
    const after=pair.historyAnchor.after, through=after+1;
    const journal={schema:1,fixtureId:f.id,after,through,records:[{seq:through,...c.event}]};
    const bytes=JSON.stringify(journal), digest=sha(bytes);
    await writeFile(input,JSON.stringify(c),{flag:'wx',mode:0o600});
    await writeFile(historyPath,bytes,{flag:'wx',mode:0o600});
    compose(f,['start','--wait','--wait-timeout','120']);
    runIsolatedFixture(f,['dist/pilot/ops/local/stack.js','check']);
    const before=run(f,'before');
    const times=run(f,'erase');
    assert.equal(run(f,'after'),before);
    compose(f,['stop']);
    compose(f,['start','--wait','--wait-timeout','120']);
    runIsolatedFixture(f,['dist/pilot/ops/local/stack.js','check']);
    assert.equal(run(f,'after'),before);
    compose(f,['down']); owned=undefined;
    // Keep the original ciphertext in the same task checkout. Only a fresh fixture occupies work/pilot.
    await rename(fixtureDir,sourceDir);
    const held=await restore(sourceDir,t=>{owned=t;});
    assert.ok(held.stopped && !held.applicationLogin && held.verifiedDatabases===2 && held.quarantined>=4);
    assert.deepEqual(held.topology,{internalNetworks:2,publishedHostPorts:0});
    const t=await loadFixture();
    assert.equal(run(t,'before'),before);
    const recover=(journalDigest: string)=>spawnSync(process.execPath,['dist/pilot/ops/local/recover.js',
      'replay-history',String(after),String(through),journalDigest],{encoding:'utf8',timeout:90000});
    for (const invalid of [{...journal,records:[]},{...journal,fixtureId:t.id},
      {...journal,records:[{...journal.records[0],id:c.peerId}]}]) {
      const bad=JSON.stringify(invalid);
      await writeFile(historyPath,bad,{mode:0o600});
      assert.equal(recover(sha(bad)).status,1);
      assert.equal(run(t,'before'),before);
    }
    await writeFile(historyPath,bytes);
    for (const applied of [1,0,0]) {
      const result=recover(digest);
      assert.equal(result.status,0,'Bound history replay failed');
      assert.equal(JSON.parse(result.stdout).history.applied,applied);
      assert.equal(run(t,'after'),before);
      if (applied===1) {
        compose(t,['stop','postgres','identity-db']);
        compose(t,['start','--wait','--wait-timeout','90','postgres','identity-db']);
      }
    }
    assert.equal(await readFile(sourceDir+'/cold-backup/pair.json','utf8'),pairBytes);
    await verifyPair(sourceDir+'/cold-backup',f.id,pair.compatibility,pair,await loadBackupKey(sourceDir));
    return {revision:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),...times,
      onlineDeadlineMet:Date.parse(times.confirmed)-Date.parse(times.authorized)<=7*86400_000,
      membershipsRemoved:1, retainedMemberships:1, sessionsRemoved:2, challengesRemoved:1,
      controls:2, encryptedDatabasesVerified:2, quarantined:held.quarantined, restartVerified:true};
  } finally {
    if (owned && (await loadFixture(true)).id===owned.id) compose(owned,['down']);
  }
}

const operation = process.env.PILOT_CONTAINER==='1' ? stage(process.argv[2] ?? '') : drill();
operation.then(result=>console.log(JSON.stringify(result))).catch((error: Error) => {
  // Raw assertion values, command output and fixture bindings belong only inside the drill.
  console.error('Customer erasure drill failed ('+(error.stack?.match(/customer-erasure[^\s()]*:\d+:\d+/)?.[0] ?? error.name)+').');
  process.exitCode=1;
});
