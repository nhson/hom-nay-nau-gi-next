# Working loop: grill → spec → implement → docs

How a new enhancement goes from an idea to a merged, documented change. It combines this repo's
harness (`CLAUDE.md`, `feature_list.json`, `progress.md`, `session-handoff.md`, `init.sh`) with the
`mattpocock-skills` plugin (install: `claude plugin install mattpocock-skills@claude-plugins-official`).

```
idea ─▶ 1 grill ─▶ 2 spec (issue) ─▶ 3 tickets? ─▶ 4 implement ─▶ 5 docs ─▶ 6 PR / merge
          │            │                               │              │
    CONTEXT.md/ADR   ready-for-agent        TDD at the seams    feature_list.json
    updated inline   GitHub issue           + code review       progress.md
```

Every session starts the same way: `./init.sh` green, then read `progress.md` and `feature_list.json`.

## 1. Grill: find out what you really want

> `/grill-with-docs I want to <idea>`

The agent interviews you one question at a time, each with its recommended answer, and reads the code
instead of asking when the code can answer. As terms and decisions settle it updates `CONTEXT.md`
(glossary) and `docs/adr/` (decisions that are hard to reverse). Use `/grill-me` for a pure interview
that writes no docs. Output: a shared understanding. **No code is written here.**

## 2. Spec: write the PRD

> `/to-spec`

Synthesises the conversation (no new interview) into a spec: problem, solution, user stories,
implementation decisions, testing decisions, out of scope. It is published as a GitHub issue labelled
`ready-for-agent`, and uses the glossary vocabulary. The agent then adds a `feat-NNN` entry to
`feature_list.json` (`not-started`, issue number in the description).

## 3. Tickets (only for big specs)

> `/to-tickets`

Splits the spec into tracer-bullet vertical slices, each declaring what blocks it. One
`feature_list.json` entry per slice, with `dependencies` mirroring the blocking edges. Skip for work
that fits one session.

## 4. Implement

> `/implement #<issue>`

On a branch: `/tdd` at the seams the spec names (here the domain core in `src/domain` first, then the
API contract; Playwright is verification only), `corepack pnpm typecheck` regularly, one full
`./init.sh` at the end, then `/code-review` (standards + does it match the spec). The feature is
`in-progress` while this runs.

## 5. Update the documents

- `docs/features.md` status table (and `docs/parity-checklist.md` if legacy parity changed)
- `CONTEXT.md` / `docs/adr/` if language or a decision changed after grilling
- `feature_list.json`: `done` with evidence (PR, test counts, what was checked in a browser)
- `progress.md` and `session-handoff.md`: state, risks, next step

## 6. Ship

Open a PR with `Closes #<issue>`. CI (lint, typecheck, unit/contract, build, Playwright) and a Vercel
preview run automatically. The owner reviews; **merging is done only on request**; `main` deploys to
production. At the end of a phase: `docs/phase-N.md`, then tag and release `phase-N`.

## Who types what

| Step | Skill | Typed by |
|---|---|---|
| Grill | `/grill-with-docs`, `/grill-me` | owner (the agent may also start it when handed a new idea) |
| Spec | `/to-spec` | owner |
| Tickets | `/to-tickets` | owner |
| Implement | `/implement` (uses `/tdd`, `/code-review`) | owner |
| Bugs | `diagnosing-bugs` | agent or owner |
| Merge / deploy / release | n/a | owner says "merge it" |

## Small changes

A copy fix, a style tweak or a one-line bug fix can skip steps 1 to 3. It still gets a
`feature_list.json` entry, a branch and PR, and a green `./init.sh`.
