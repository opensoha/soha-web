---
name: soha-frontend
description: Implement or review soha-web React and Ant Design UI, shared tables and tags, routing, data ownership, themes, and loading boundaries. Public API contracts belong to soha-contracts.
---

# Soha Frontend

## Workflow

1. Read the affected implementation, callers, tests, and styles. Preserve existing worktree edits.
2. For feature ownership, routes, API/query/mutation, state, CSS ownership, or loading boundaries,
   read [architecture-development.md](references/architecture-development.md).
3. For UI, including tables, tags, queries, overviews, and tokens, read
   [theme-system.md](references/theme-system.md). These are target conventions, not evidence that
   every existing page has already migrated.
4. Use the `antd` skill for component APIs; check the installed version in `package.json` and
   query the CLI before writing component code. Do not pin a patch version in this skill.
5. For cross-module questions, use the existing `graphify-out/graph.json` when it helps and verify
   important findings against source. Ordinary lookup uses direct search; graph refresh is only
   for requested graph maintenance or relevant structural changes, not styling edits.

## Boundaries

- Business code belongs in `src/features/<domain>/<capability>/`; promote shared code only for
  actual reuse, not file hierarchy symmetry.
- Feature manifests and the central registry own routes. Keep `src/routes/index.tsx` limited to
  shells; load heavy editors, charts, graphs, and terminals from their visible leaf.
- `src/services/api-client.ts` owns transport; feature API/query/mutation modules own wire calls,
  keys, caching, and invalidation. Pages must not bypass them or deep-import another feature's
  private implementation. TanStack Query owns server state; Zustand owns persistent UI context.
- Keep one app-level `ConfigProvider` in `src/main.tsx`; `src/theme/app-theme.ts` owns tokens.
  Shared components own visual conventions, not page-local overrides.
- Management tables follow `ManagementDataPage` (page shell) → `AdminTable` (shared table) →
  Ant Design `Table` (implementation). Use `StatusTag` for states, `MetadataTag` for categories,
  and `BooleanTag` for boolean labels. Follow the theme reference for exact presentation.
- Preserve authorization, mutation confirmations, loading/error/no-permission states, keyboard
  access, and labels alongside color. Never put provider credentials in browser configuration.
- Do not repeat identity or navigation already supplied by breadcrumbs. Delete redundant copy;
  place non-obvious field guidance in a keyboard-accessible help tooltip.

## AI Workbench

- Reuse Ant Design X primitives (`Conversations`, `Welcome`, `Prompts`, `Bubble.List`, `Sender`,
  `ThoughtChain`); separate controller/data ownership from presentation.
- XRequest is for AI streaming/provider requests, not CRUD. Browser provider requests go through
  the same-origin backend proxy.
- Chat, DAG, topology, terminal, noVNC, and graphs may use scene-specific layouts, but still use
  shared tokens. Management lists and overview summaries retain shared surfaces.

## Verification

- Run targeted tests and lint; after antd changes, run
  `antd lint <changed-path> --format json` (one path per invocation).
- Verify visual changes in light/dark themes and narrow/wide layouts, including long values,
  overflow, empty states, and interactions. Report unavailable browser checks explicitly.
- `package.json` and `.github/workflows/*.yml` are the executable gate source. Code completion
  includes lint, tests, and build; broad changes also require coverage and relevant route,
  boundary, and bundle gates from the architecture reference.
- Documentation-only changes require metadata, link, source-agreement, and diff checks, not
  application builds. Report failing gates separately from completed work; do not suppress type
  errors or change contracts/dependencies to finish an unrelated UI task.
