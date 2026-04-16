# Copilot Cloud Agent Instructions

Use this repository for one narrow job: keep the deterministic Codex multiaccount patch pipeline healthy across upstream Codex releases.

## Priority

1. Prefer deterministic fixes over one-off hacks.
2. Keep the scope on patch maintenance, focused regressions, manifest generation, and release automation.
3. Do not change public release history or mutate an already published release tag in place.

## Failure-issue workflow

When assigned an automated upstream maintenance issue:

1. Start from the linked workflow run and inspect its artifacts first.
2. Reproduce the failure with the exact upstream version using `publish-hotpatch`.
3. Fix the smallest thing that restores the automated path.
4. Validate with `npm test`.
5. If workflow logic changed, keep the green path fully automatic and the failure path issue-driven.

## Repo-specific guardrails

- The maintained patch logic lives in `src/lib/maintained-patch.js`.
- Focused upstream regression coverage lives in the Rust tests exercised by `publish-hotpatch` and `compatibility-sweep`.
- Release automation must fail closed when an overlay or manifest does not match the exact upstream binary hash.
- Do not widen support claims without a passing automated run for the targeted upstream version.

## Avoid

- Do not replace the maintained patch program with a brittle binary diff.
- Do not remove the focused regressions just to make CI green.
- Do not bypass manifest validation or release URL validation.
