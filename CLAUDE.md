# Agent Guidance

## Project

This is an Effect v4 TypeScript CLI project. Use npm for package management.

## Before Editing Effect Code

Always consult the local Effect guidance before writing or changing Effect code:

1. Run `effect-solutions list`.
2. Run `effect-solutions show <relevant-topics>`.
3. Search `~/.local/share/effect-solutions/effect` for real v4 implementations when an API or pattern is unclear.

Prefer the current installed v4 APIs over older Effect examples.

The local Effect v4 source is available at `~/.local/share/effect-solutions/effect` for API and implementation reference.

## Implementation Rules

- Use `Effect.gen` and `yield*` for sequential Effect workflows.
- Use `Effect.fn("name")` for reusable effectful functions and service methods.
- Model services with `Context.Service` and compose dependencies through `Layer`.
- Keep errors typed with `Schema.TaggedError` and recover with `Effect.catchTag` or `Effect.catchTags`.
- Decode SQL, JSON, CLI, and other external data with `Schema` before using it as domain data.
- Provide application layers once at the CLI entry point.
- Use `@effect/vitest` and `it.effect` for Effect tests.

## Verification

Run these commands after changes:

```sh
npm run check
npm test
npm run build
```

Run a relevant CLI smoke test when changing commands or persistence.

## Generated Content

`topics/` contains generated user content and is intentionally ignored by git. Do not add or commit files under `topics/`.
