# Isolated worker wake handover

[Issue #286](https://github.com/Maeximilion/MaexSocial/issues/286) delivers the
[ordinary local wake command](../../../ops/local/README.md#isolated-text-worker-wake-286)
on `dev-codex/286-isolated-worker-wake`. The command uses the fixture's current approval,
global occurrence identity, stop control and persistent local fake. Existing attempts go
through readback. The fake uses its existing PROCESSING scenario.

The focused Windows run used the pinned Node 24.22.2 runner. Two worker database sessions
waited on the same draft lock and exactly one claim, one create and one stored approved
intent survived. New worker invocations after stop still reported pending for the existing
attempt. An independent eligible occurrence remained approved. Three malformed wakes added
zero creates, attempts, exports, reservations, charged units or provider-state files.
The fixture had zero media/job/storage relations and zero published host ports. The checks
observed fixture isolation and stored effects. They did not capture network packets.

The [Task 4 parent](https://github.com/Maeximilion/MaexSocial/issues/165) retains integrated
public-route and all-role evidence. Check the delivery PR for the current head, base, Claude
API execution and hosted merge candidate. The coordinator owns the merge.
