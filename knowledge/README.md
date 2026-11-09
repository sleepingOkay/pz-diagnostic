# Diagnostic knowledge rules

This folder is the offline knowledge base. Rules are executable data loaded by `index.html`; keep explanations and evidence in the rule itself so the report can show why it matched.

## Required fields

- `id`: stable, unique identifier.
- `category`: technical area.
- `severity`: `error`, `warning`, or `info`. Severity describes the log event, not certainty about the root cause.
- `confidence`: `high`, `medium`, or `low`. Confidence describes the interpretation of the signature.
- `pattern`: JavaScript regular expression source, matched case-insensitively.
- `title` and `description`: plain-language explanation.
- `causes`: plausible explanations, not claims of fact.
- `checks`: reproducible checks that can confirm or reject the hypothesis.
- `recommendation`: safest next action.

## Optional matching controls

- `requires`: every regular expression in this array must match the log.
- `excludes`: if any regular expression matches, the rule is skipped.
- `builds`: exact game build strings for which the rule is allowed to run. If the log does not identify one of these builds, the rule is skipped.
- `minOccurrences`: minimum number of matches required.

## Provenance and scope

- `source`: where the rule came from (official documentation, reproducible test, issue report, or anonymized log).
- `scope`: important limits on what the rule can conclude.
- `verified`: use `true` only after independent reproduction or strong authoritative confirmation. A rule based on one log must remain `false`.

## Rules we must follow

1. Never infer that a mod caused a crash just because it was loaded or appears in the same log.
2. A stack frame identifies code involved in a call path; it does not prove who supplied bad data.
3. Do not apply build-specific compatibility claims to other builds.
4. Keep one-off observations separate from confirmed compatibility rules.
5. Prefer exact exception + stack context + mod attribution over broad words such as `error`, `missing`, or `failed`.
6. Every new rule should include a test log or a documented reason why it is safe to add.
7. Do not remove a rule just because it did not match one log; record its supported conditions and test coverage.

The knowledge base is intentionally conservative. It should say "unknown" rather than manufacture a culprit.
