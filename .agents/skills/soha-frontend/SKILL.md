---
name: soha-frontend
description: Soha Web frontend architecture and UI standards. Use when editing or reviewing soha-web React and Ant Design code involving capability ownership, route manifests, API/query/mutation layers, shared types and state, theme surfaces, management pages, data-dense tables, detail overviews, lazy loading, bundle boundaries, or Ant Design X and XRequest AI workbench flows.
---

# Soha Frontend

## Purpose

Keep `soha-web` changes inside the verified capability architecture, route registry, data
layer, loading boundaries, and Soha visual system.

## Required Workflow

1. Read the affected route manifest, capability directory, data layer, tests, and CSS before
   editing.
2. For broad architecture or dependency questions, query `graphify-out/graph.json` first.
   Refresh it only after structural changes are stable and the worktree contents are
   understood; use `graphify update . --force` after deletions and audit graph health.
3. Read `references/architecture-development.md` for feature, route, API/query/mutation, type,
   state, CSS boundary, lazy-loading, testing, or Graphify work.
4. Read `references/theme-system.md` for theme variables, visual surfaces, management
   tables/search, template designers, workflow canvas, graphs, or AI workbench UI.
5. When using antd components, use the `antd` skill and query the local CLI for the installed
   version before writing unfamiliar APIs.
6. Make one bounded capability change at a time and run checks proportional to its blast
   radius.

## Architecture Invariants

- Organize business code as `src/features/<domain>/<capability>/`; promote code to feature
  `shared/` only after multiple sibling capabilities have real consumers.
- Keep one real UI route per leaf dynamic page module. Route metadata, permission, menu,
  redirect, shell, and loader must originate from feature route manifests and the central
  registry.
- Keep `src/routes/index.tsx` limited to public, portal, and authenticated app shells. Do not
  add page imports or a second route table there.
- Keep transport in `src/services/api-client.ts`; expose feature wire calls through `api.ts`,
  hierarchical query key factories through `keys.ts`, reusable `queryOptions` through
  `queries.ts`, and mutation options plus exact invalidation through `mutations.ts`.
- Do not import `api-client` directly from ordinary route pages, add bare array query keys, or
  deep-import another feature's private capability.
- Keep server state in TanStack Query, persistent auth/scope/preferences in existing Zustand
  stores, and transient selection/modal/form state local to the page.
- Load Flow/VChart, Monaco, xterm, noVNC, terminal, console, and graph runtimes only from the
  user-visible leaf that needs them. Do not use manual chunks to hide an application boundary
  problem.
- Keep capability CSS owned by its page or capability entry. Utility/model/query modules must
  not import CSS for side effects.

## Theme And Components

- Use Ant Design 6 as the component foundation and keep exactly one app-level
  `ConfigProvider` in `src/main.tsx`.
- Treat `src/theme/app-theme.ts` as the source of truth for antd tokens and Soha CSS variables.
- Prefer existing Soha page shells, management components, tokenized search controls, and
  semantic status treatments over page-local variants.
- Use `StatusTag` for lifecycle, health, result, and severity values. Use `MetadataTag` for
  categorical metadata such as task category, access mode, and capability labels. Both use the
  compact Ant Design `filled` treatment; do not introduce raw outlined tags or page-local tag
  colors for ordinary management surfaces.
- Keep tag collections single-line per tag and wrap the collection container. Do not let a long
  tag list increase a management-table row without a deliberate overflow or summary treatment.
- Use `ManagementDataPage`, `ManagementQueryPanel`, `ManagementQueryField`,
  `ManagementQueryScope`, `ManagementKeywordField`, `ManagementQueryActions`,
  `ManagementTableToolbar`, and `AdminTable` for ordinary management pages.
- Keep management-table toolbars on the shared control height and spacing. Do not add page-local
  height, padding, or divider overrides.
- For scan-heavy tables and detail overviews, follow the density, grouping, and decoration rules
  in `references/theme-system.md`.
- Do not repeat the current page identity, generic explanatory copy, or a back-to-list action below
  a breadcrumb that already provides that context and navigation.
- Keep DAG, topology, terminal, noVNC, charts, and AI graph as token-driven scene exceptions.
- Prefer current Ant Design 6 APIs such as `Card.styles.body`, `Alert.title`, and
  `showSearch={{ optionFilterProp: 'label' }}`.
- Top-level management lists must retain the `AdminTable` pagination footer and summary. Map
  cursor APIs onto its page/page-size callbacks; do not replace the footer with toolbar arrow
  buttons. Use `pagination={false}` only for deliberately embedded, non-paged tables.

## AI Workbench

- Keep Ant Design X components as the base: `Conversations`, `Welcome`, `Prompts`,
  `Bubble.List`, `Sender`, and `ThoughtChain`.
- Keep Workbench controller/data ownership separate from shell/layout/presentation ownership.
- Use XRequest only for AI streaming/provider requests, never for normal CRUD clients.
- Call same-origin backend proxy paths from browser code. Never place provider tokens, API
  keys, model credentials, or raw authorization secrets in browser configuration or state.

## Validation

Run targeted tests while iterating. Before completing architecture, route, data-layer, or
loading-boundary work, run:

```bash
npm run format:check
npm run typecheck
npm run lint
npm test
npm run check:routes
npm run check:frontend-boundaries
npm run check:bundle-budget
npm run build
```

Run `npm run test:coverage` for broad changes, `antd lint src --format json` after antd changes,
and browser regression for route, redirect, direct-refresh, permission, loading, error, and
layout changes. Do not declare completion from file moves alone.
