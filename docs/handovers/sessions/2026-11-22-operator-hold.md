# Selected occurrence hold · #212

The unmounted [domain entry point](../../../packages/contracts/occurrence.ts) checks the independently supplied
management session, verified identity, enrolled device and versioned platform grant against the target tenant
and occurrence. The trusted context must bind a phishing-resistant assertion to the same session and target.
The transaction checks the stored assertion time after acquiring locks. An assertion exactly five minutes old
is accepted. The existing management session expiry and revocation deny access independently.

An eligible draft or approved occurrence becomes `held` and records one audit with tenant, occurrence, actor,
device, the trimmed reason, time and outcome. A repeated authorized hold preserves the original audit. A claim
that acquired the occurrence lock first retains its attempt and reports its current status. The same occurrence
lock must be used by the future claim and export entry points. Audit failures roll back the hold.

With the [isolated fixture](../../../ops/local/README.md) prepared, run:

```text
npm run pilot:build
npm run pilot:migrate -- up
node --test dist/pilot/tests/pilot/occurrence-hold.test.js
```

The [fixture test](../../../tests/pilot/occurrence-hold.test.ts) drives this entry point as the application
database role. It covers two approved siblings and a foreign tenant, concurrent repeat holds, scope and
authority denial, the exact age boundary, a claim-first database barrier, atomic audit failure and recovery.
The fixture constructs management evidence independently of the operation. This is local domain evidence
for [ACCESS-05](../../17_ACCESS_SECURITY.md#access-contracts-and-staging-review). The integrated management listener,
device and identity verification and client evidence remain in [#164](https://github.com/Maeximilion/MaexSocial/issues/164).
Actual worker, export and provider behavior remain in [#165](https://github.com/Maeximilion/MaexSocial/issues/165).
