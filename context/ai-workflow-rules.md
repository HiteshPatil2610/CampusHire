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
- `project-overview.md` — if scope changes (a feature moves in or out of V1)

## Before Moving to the Next Unit

1. The current unit works end to end within its defined scope, including the relevant role/department access checks.
2. No invariant defined in `architecture.md` was violated.
3. Vitest coverage exists for any new eligibility, validation, or profile-completion logic, and passes.
4. `progress-tracker.md` reflects the completed work, updated open questions, and next unit.
5. `npm run build` passes with no TypeScript errors and no console errors in the affected role dashboard(s).
