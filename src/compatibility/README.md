# Compatibility Directory

This directory contains compatibility facades for legacy modules that are
deprecated but retained during the migration transition period.

## Contents

| File | Purpose | Removal Target |
|------|---------|----------------|
| `legacy-specialist-pipeline.ts` | Re-exports legacy specialist generation, delegation planner, compliance, and graph modules | Release C |

## Import Rules

1. **Non-compatibility code** must NOT import directly from deprecated modules:
   - `src/core/delegation-planner.ts`
   - `src/core/delegation-compliance.ts`
   - `src/core/delegation-graph.ts`
   - `src/core/specialist-generator.ts`

2. **Non-compatibility code** that needs legacy functionality must import through the facade:
   ```typescript
   // Correct:
   import { generateAllSpecialists } from '../compatibility/legacy-specialist-pipeline.js';

   // Wrong:
   import { generateAllSpecialists } from '../core/specialist-generator.js';
   ```

3. **Test files** for legacy modules may import directly from the deprecated modules
   (they are testing those modules directly, which is intentional).

## Removal Conditions

Remove this entire directory in Release C when:
- `--legacy-specialists` flag is removed
- `fetchAllCheatSheets` install-time path is removed from installer
- All specialist-related types are removed from `types.ts`

See `migration-plan/retirement-checklist.md` for complete removal tracking.
