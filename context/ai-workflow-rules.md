# AI Workflow Rules

## Approach

Build CampusHire incrementally using a spec-driven workflow. The context files (`project-overview.md`, `architecture.md`, `ui-context.md`, `code-standards.md`) define what to build, how to build it, and what it must never do. Each unit of work is implemented against a spec file in `context/specs/`. Do not infer or invent product behavior, data models, or visual decisions that are not defined in the context files or the current spec — resolve ambiguity by updating the relevant context file, not by guessing in code.

## Scoping Rules

- Work on one feature unit at a time, as defined by the current spec file in `context/specs/`.
- Prefer small, verifiable increments over large speculative changes.
- Do not combine unrelated system boundaries in a single implementation step (e.g. do not touch drive-eligibility logic while implementing the student profile form).
- Do not build ahead into out-of-scope features listed in `project-overview.md` (resume builder, AI analyzer, readiness score, multi-college support) even if it seems like a natural extension.

## When to Split Work

Split an implementation step if it combines:

- UI changes and access-control/permission logic changes
- Multiple unrelated API routes or server actions across different `features/` folders
- Database schema changes and the feature code that depends on them (migrate first, then build)
- Behavior not clearly defined in the context files or the current spec

If a change cannot be verified end to end quickly, the scope is too broad — split it.

## Handling Missing Requirements

- Do not invent product behavior, eligibility rules, or role permissions not defined in the context files.
- If a requirement is ambiguous (e.g. an edge case in Excel validation, an unclear eligibility rule), resolve it in `project-overview.md` or `architecture.md` before implementing — do not silently pick an interpretation.
- If a requirement is missing entirely, add it as an open question in `progress-tracker.md` and pause that part of the implementation rather than guessing.

## Database Safety

- Never run `prisma migrate dev`, database resets or destructive reset flags against the connected Neon database, and never drop tables, columns or data automatically.
- For any destructive or irreversible change: inspect dependencies, produce an impact/dry-run report, explain exactly what would change, and stop for confirmation before executing it.
- Ask before applying a migration to production, before deleting a Neon branch, and before any other irreversible action — approval for one does not extend to the next. The process is in `code-standards.md` (Migrations).
- Do not claim something was verified unless it was actually verified (tests run, migration probed, screen opened). Say what was not verified.

## Protected Files

Do not modify the following unless explicitly instructed:

- `components/ui/*` — shadcn/ui generated components; update via the shadcn CLI, not by hand
- `prisma/migrations/*` — generated migration files; never hand-edit a committed migration
- `context/*` templates' structure — content is updated continuously, but do not remove required sections

## Keeping Docs in Sync

Update the relevant context file whenever implementation changes:

- `architecture.md` — if system boundaries, storage model, or an invariant changes
- `code-standards.md` — if a new convention or pattern is adopted
- `ui-context.md` — if a new token, component pattern, or layout pattern is introduced
- `project-overview.md` — if scope changes (a feature moves in or out of V1) or a user-facing flow changes
- `progress-tracker.md` — after every meaningful implementation change, with what was found, decided, changed, tested and left open
- Historical specs (`specs/`, `specs_architecture/`, `arch-fix/`) describe how work was requested. They are not updated to match later changes; `architecture.md` and `progress-tracker.md` are the current truth.

## Before Moving to the Next Unit

1. The current unit works end to end within its defined scope, including the relevant role/department access checks.
2. No invariant defined in `architecture.md` was violated.
3. Vitest coverage exists for any new eligibility, validation, or profile-completion logic, and passes.
4. **The whole suite passes — zero failures.** A failing test is either a defect to fix or a test that has outlived its subject and must be rewritten against what the code now does. It is never a number carried forward in a report as a "known baseline"; that is how a real regression hides among stale ones.
5. No test reaches the real database, the network or a real Clerk instance. `@/lib/prisma` is mocked; a test that needs a request-scoped React API gets it from `vitest.setup.ts`.
6. `progress-tracker.md` reflects the completed work, updated open questions, and next unit.
7. `npm run build` passes with no TypeScript errors and no console errors in the affected role dashboard(s).
