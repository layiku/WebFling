# Final Task

This document records the remaining review follow-ups for the next agent.

> **Status: FINISHED** — all tasks completed and verified (2026-05-02).

## 1. Guard `GameSession.commitMove`

`src/app/gameSession.ts` exposes `commitMove()` as the public atomic move commit API. It currently commits even when the session is already in a terminal phase, because `pushUndoSnapshot()` silently skips snapshots outside `playing` while `executeMovePhysics()` still mutates the board.

Required change:

- Add a `phase === 'playing'` guard to `commitMove()`.
- Prefer returning `boolean` so callers and tests can distinguish committed vs ignored moves.
- Do not add `canMove()` validation inside `commitMove()`. Existing abnormal-state tests rely on `commitMove()` being able to bypass move legality while still respecting session phase.

Suggested shape:

```ts
commitMove(startCell: number, dx: number, dy: number): boolean {
  if (this.phase !== 'playing') return false
  this.pushUndoSnapshot()
  this.executeMovePhysics(startCell, dx, dy)
  return true
}
```

Test requirement:

- Add a `GameSession` unit test proving that calling `commitMove()` after a win returns `false` and leaves the board unchanged.

## 2. Update Test Traceability

The project now enforces production board dimensions as `7x8` in both runtime loading and offline level-pack validation. The tests exist, but `docs/TEST_TRACEABILITY.md` does not yet list the new behavior.

Required change:

- Add traceability rows for runtime and offline fixed-dimension validation.

Suggested rows:

```md
| Production levels fixed at 7x8: runtime loader rejects non-7x8 dimensions | Implemented | `loadLevels.test.ts` -> `rejects non-7x8 dimensions` |
| Production levels fixed at 7x8: offline level-pack validator rejects non-7x8 dimensions | Implemented | `validate-level-pack.test.ts` -> `rejects non-7x8 dimensions` |
```

Use the document's existing language/style if keeping the table in Chinese.

## Verification

After the changes, run:

```bash
npm run test
npm run levels:validate
npm run build
```

If `gameUi.ts` or the animated submit path is changed, also run:

```bash
npm run test:e2e
```
