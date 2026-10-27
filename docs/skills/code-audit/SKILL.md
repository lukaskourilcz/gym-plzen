---
name: code-audit
description: Audit an application or substantial change for security, correctness, reliability, performance and maintainability. Use for an explicitly requested code or release audit; ordinary edits do not require a whole-application audit.
---

# CODE AUDIT

Produce an evidence-backed audit, fix authorized defects and verify the release boundary. Treat a green test suite as evidence about tested scenarios, not proof of correctness.

## Establish scope and safety

- Read repository instructions, current branch/diff, architecture and deployment configuration. Preserve unrelated local edits. Identify the reviewed commit, production target and permitted side effects.
- An audit alone authorizes inspection, not sending messages, charging/refunding payments, changing devices or releasing code. Honor deployment authorization already given by the user; do not ask again merely because this skill mentions a release boundary.
- Run adversarial and failure tests against isolated data and provider replacements. Never exercise production write paths as a smoke test. Some GET routes reconcile payments or deliver notifications; classify side effects from code before invoking them.
- Do not retrieve or print secrets to make review convenient. Prefer existing authenticated tools and non-sensitive metadata.

## Map the entire surface

Build a coverage ledger before reviewing details: entry points, identity/authorization, domain services, database and migrations, external integrations, scheduled work, frontend/data loading, documents/content, configuration/dependencies and delivery pipeline. Record concrete files, callers, tests and evidence for each area. Inventory is not review: label items reviewed, tested, not applicable or unverified, with reasons. Revisit callers outside the diff when invariants cross module boundaries.

Read [references/review-checks.md](references/review-checks.md) and apply relevant checks to every area. Start with irreversible effects, money, identity and concurrency, then expensive or frequently used paths. Read complete control flows for critical operations, including retries and recovery, rather than isolated changed lines.

## Establish findings

For each suspected defect, give its trigger, violated invariant, user impact, precise location and reproduction or supporting evidence. Distinguish a demonstrated bug from an untested risk or style preference. Use severity based on impact and likelihood; avoid filling a report with cosmetic refactors.

For each critical state transition examine success, duplicate, stale/reordered response, ambiguous provider outcome, process crash before/after an external effect, timeout, concurrent operation and recovery after an upgrade. Re-read authoritative state after acquiring a lock. Verify fairness of bounded retry queues, not just single-item retry success.

Measure performance before optimizing: request/interaction timing, query counts/plans, rows read, payload/bundle size and connection contention. Use representative isolated fixtures; production measurements are read-only and bounded. Mark inferred or unmeasured improvements honestly. Do not run EXPLAIN ANALYZE on mutating SQL in production.

## Fix and prove

Reproduce material defects with focused regression tests that fail before the fix and assert business outcomes. Preserve API contracts and unrelated design. Prefer small cohesive fixes and commits over broad rewrites. Include database constraints/indexes when they enforce an invariant or a measured access pattern; assess lock and deployment cost.

After a fix, inspect its failure paths and callers again. Run focused checks first, then the required full suite and production build on the final code. Audit dependency changes for actual advisory/version compatibility. Do not suppress checks or weaken assertions to obtain green results. A test may allow framework-added headers while still checking the actual security requirement.

## Release and report

Follow existing release tooling. Inspect exact project, environment, migration history and commit before mutation. Review migration statements for business-data changes, triggers, seeds and remote effects; rehearse on an isolated previous schema with representative historical records. Capture and compare the relevant original fields within the migration transaction when preservation is required. Keep financial evidence and reconciliation data on rollback.

Deploy only if already authorized and material release blockers are resolved. Do not merge while required checks fail or the deployed code lacks its schema. Check the resulting production commit/readiness and bounded read-only health/performance; do not invoke customer workflows, jobs or providers to prove deployment.

Report fixes, evidence, remaining limitations, tested commit and release status. Include the coverage ledger and measured performance where useful. Never claim that every vulnerability is absent or that untouched/untested areas were verified. A remaining blocker means the release is incomplete, even if other audit work is finished.
