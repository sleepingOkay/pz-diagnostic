# Diagnostic regression checklist

These cases are required before accepting a new diagnostic rule or changing attribution behavior.

## Build-scoped Viewpoint signature

1. A log reporting Build 42.21.0, the Float-to-Boolean `ClassCastException`, and a `viewpoint.world.WallMesher.wall` frame should show the observed Viewpoint signature.
2. The same exception without a WallMesher frame must not show that Viewpoint-specific rule.
3. The same exception and stack frame under a different build must not show the Build 42.21.0-specific rule.
4. A log without a detectable game build must not show the Build 42.21.0-specific rule.
5. The report must show the one-log scope and must not call the finding a confirmed compatibility defect.

## Attribution

1. A Lua stack line containing `Lua(SomeMod).functionName(File.lua:12)` should add `SomeMod` to the detected mod list.
2. A line containing `| MOD: SomeMod` should add `SomeMod`.
3. `Lua(Vanilla)`, `Lua(Base)`, and `Lua(Shared)` must not be listed as third-party mods.
4. A mod merely appearing in the loaded-mod list must not be declared responsible for an exception.

## Knowledge-base enrichment

1. A raw Java exception that also matches a curated rule should appear once, with the curated causes, checks, confidence, and recommendation.
2. A ViewpointInteriorSurfaces `WallMesher.back` missing-method finding should not also appear as a duplicate generic missing-method finding.
3. Repeated occurrences should be counted without being presented as multiple independent root causes.

## General safety

- A warning is not automatically a crash cause.
- A stack frame is evidence of involvement in a call path, not proof of fault.
- If no rule matches, the report must say the signature is unknown rather than claiming the log is clean.

## Lua stack traces

1. A `stack traceback:` block containing `Lua(SomeMod).functionName(File.lua:12)` should be included in the Lua finding evidence.
2. The finding may name `SomeMod` as a stack-trace lead, but must explicitly avoid calling it the proven cause.
3. Frames labelled `Lua(Vanilla)`, `Lua(Base)`, or `Lua(Shared)` must not be attributed to third-party mods.
