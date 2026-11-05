# Agent roles and research handovers

Keep the existing Codex reviewer and Claude evidence researcher. The recurring need in [#5](https://github.com/Maeximilion/MaexSocial/issues/5) and [#6](https://github.com/Maeximilion/MaexSocial/issues/6) is a short handover that lets a second reader tell what a public source establishes and what still needs runtime verification. The assigned Codex work chat can produce it directly.

## Primary sources

Stars are GitHub adoption snapshots taken on 2026-11-05. Dates in the second column identify the pinned commits. Runs are linked separately.

| Repository | Source and activity | What the evidence supports |
|---|---|---|
| OpenAI Codex · 133,274 stars | [Issue labeler, Nov 5](https://github.com/openai/codex/blob/e7f32cf1928a35a9232a633a51c2a03b5a7e2c72/.github/workflows/issue-labeler.yml) · [Actions run](https://github.com/openai/codex/actions/runs/42002742170) | The model job uses a read-only sandbox and returns structured label suggestions. The model job needs an OpenAI API key. A separate job needs issue-write permission to apply labels. The hosted run records success for both jobs. The apply command suppresses errors, so the green job alone cannot confirm a label change. Label accuracy was not evaluated. |
| Anthropic Claude Code · 154,600 stars | [Issue triage, Nov 4](https://github.com/anthropics/claude-code/blob/26382c08758260c9f5deb2019d8fe851f89fa9ae/.github/workflows/claude-issue-triage.yml) · [Actions run](https://github.com/anthropics/claude-code/actions/runs/42003133958) | The job bounds event scope, tools and runtime. It requires a firewall runner, federated credentials and issue-write permission. The hosted Claude triage step succeeded. |
| Anthropic official Claude plugins · 46,183 stars | [Feature explorer, Nov 4](https://github.com/anthropics/claude-plugins-official/blob/fa4eb54397ee2faccb6940512a19c017cb1337f3/plugins/feature-dev/agents/code-explorer.md) | The Claude plugin defines a Sonnet role that traces a feature from entry point to data storage and returns file/line references. We inspected its definition only. |
| Obra Superpowers · 312,657 stars | [Reviewer handoff, Nov 3](https://github.com/obra/superpowers/blob/22f0b463e7a5e579904dd6211a520321035526f7/skills/subagent-driven-development/references/cannot-verify.md) · [integration test](https://github.com/obra/superpowers/blob/22f0b463e7a5e579904dd6211a520321035526f7/tests/claude-code/test-subagent-driven-development-integration.sh) | The task owner resolves claims the reviewer cannot verify from the diff. The published Bash/Claude Code test checks subagent dispatches and repository outputs. We read the test without running it. |
| Aider · 49,959 stars | [Release attribution data, May 22 snapshot](https://github.com/Aider-AI/aider/blob/5dc9490bb35f9729ef2c95d00a19ccd30c26339c/aider/website/_data/blame.yml) | For v0.6.0, dated June 15, 2023, the project attributes 47 of 150 new lines to Aider. This historical self-report supports a bounded AI-assistance claim. It does not measure code quality or establish whole-repository authorship. |

## Decisions and smallest checks

| Decision | Responsibility, owner and evidence |
|---|---|
| **Keep** the Codex reviewer | The assigned independent reviewer receives a base, head and scope and returns actionable defects or a clean result. Its definition instructs it to avoid edits. A real Astra/high review found an eligibility defect and checked the corrected head. Verify actual model, effort and permissions on future invocations. [Definition](https://github.com/Maeximilion/MaexSocial/blob/8c09b5be4dd51740793116edd56565c62012dc42/.codex/agents/reviewer.toml) · [PR #52 review](https://github.com/Maeximilion/MaexSocial/pull/52#issuecomment-6652483219) |
| **Keep** the Claude evidence researcher | An explicitly assigned Claude research lane receives a scoped question and returns dated references and gaps. Its tool list permits reading, search and fetch. Static inspection verified the definition. Invocation of the named role remains unverified. [Definition](https://github.com/Maeximilion/MaexSocial/blob/8c09b5be4dd51740793116edd56565c62012dc42/.claude/agents/evidence-researcher.md) |
| **Adapt** the research handover for the primary Codex work chat | The assigned issue owner can return the question, allowed access, dated source, evidence class, finding and remaining gap. One read-only example appears below. |
| **Defer** a dedicated feature explorer | The implementation owner can trace callers in the work chat. Reconsider when repeated product tasks need the same investigation. The smallest future proof would trace one real feature through its caller, implementation and test. |
| **Omit** model-driven issue triage, extra reviewers and a standing agent pool | Existing deterministic metadata maintenance, independent review and coordinator-owned assignments cover the observed work. We found no recurring input that requires another privileged role. [Metadata workflow](https://github.com/Maeximilion/MaexSocial/blob/8c09b5be4dd51740793116edd56565c62012dc42/.github/workflows/issue-maintenance.yml) |

## Public handover example

**Question from #5:** Can MaexSocial keep a Runway generation result by saving only the returned URL?

**Scope:** Public documentation, read on 2026-11-05.

**Finding:** Runway documents that output URLs expire within 24–48 hours of accessing the API and directs clients to download the result to their own storage. [Runway output documentation](https://docs.dev.runwayml.com/assets/outputs/)

**Evidence class and gap:** Provider documentation. Actual expiry in an account and provider-side deletion were not tested. The example demonstrates the handover format and leaves #5 with its assigned owner.

Assessment dated 2026-11-05 for [issue #66](https://github.com/Maeximilion/MaexSocial/issues/66). The [merged assessment](https://github.com/Maeximilion/MaexSocial/pull/52) records CI, independent review, work-package and ADR provenance, and stack-safety decisions. The [anatomy walkthrough](https://github.com/Maeximilion/MaexSocial/issues/63) covers newcomer navigation, contribution and security paths. The [coordinator procedure](https://github.com/Maeximilion/MaexSocial/issues/64) owns assignments and serial stack merges. These areas revealed no additional role requirement in this comparison.
