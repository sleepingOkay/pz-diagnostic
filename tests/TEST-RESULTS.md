# Current validation status

Last local validation: 2026-11-07.

## Automated in-memory checks

- JavaScript syntax compilation: passed for `app.js` and all six knowledge files.
- Knowledge rules loaded: 20.
- Build 42.21.0 + Float-to-Boolean cast + `WallMesher.wall`: specific observed rule matched.
- Same signature under Build 42.20.4: Build 42.21.0-specific rule did not match.
- Same signature without a detectable build: Build 42.21.0-specific rule did not match.
- Same signature without the WallMesher frame: Viewpoint-specific rule did not match.
- `WallMesher.back` missing-method + ViewpointInteriorSurfaces: specific addon mismatch rule matched.
- Lua stack trace with `Lua(SomeMod)`: trace evidence was captured and SomeMod was listed as an investigation lead.
- Vanilla Lua frame: not listed as a third-party mod.

## What this does not prove

These are synthetic regression checks, not a broad validation against real user logs. The one-log Viewpoint WallMesher signature remains unverified. More anonymized logs and reproducible mod/build tests are needed before promoting observations into confirmed compatibility rules.
