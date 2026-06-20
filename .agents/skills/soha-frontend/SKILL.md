---
name: soha-frontend
description: Soha Web frontend standards for theme, layout, component reuse, and AI workbench UI. Use when editing or reviewing soha-web React/Ant Design pages, CSS surfaces, src/theme/app-theme.ts, management tables/search, template designers, DAG/workflow canvas, or Ant Design X/XRequest workbench flows.
---

# Soha Frontend

## Overview

Use this skill to keep `soha-web` frontend changes aligned with the Soha product theme and interaction model. The current direction replaces the older gray, shadcn-like visual language with an Ant Design 6 based Soha blue/cyan theme, shared surface tokens, reusable management components, workflow canvas conventions, and a secure AI workbench request boundary.

## Operating Rules

- Treat Ant Design 6 as the component foundation.
- Keep exactly one app-level `ConfigProvider`, owned by `src/main.tsx`.
- Treat `src/theme/app-theme.ts` as the source of truth for antd tokens and Soha CSS variables.
- Prefer Soha CSS variables and antd tokens over page-level hardcoded colors, shadows, radii, and selected states.
- Keep the light theme global base/layout background white: `colorBgBase`, `colorBgLayout`, `--soha-bg-base`, and `--soha-bg-layout` should stay `#ffffff` so the left menu rail and right page rail render as `rgb(255, 255, 255)`.
- Keep shape tokens split by purpose: `--soha-radius-control` for inputs/buttons/list items, `--soha-radius-panel` for cards/query panels/detail headers/table shells, and `--soha-radius-lg` for larger scene containers.
- Keep management search width token-driven: `--soha-management-query-field-default-width` and `--soha-management-toolbar-search-width` are the default search widths (currently 300px); narrow pages must adapt through shared component responsiveness, not page-local `220/240/260px` search widths.
- Use the current token names such as `--soha-border-color`, `--soha-bg-surface`, `--soha-bg-surface-muted`, and `--soha-primary`; do not reintroduce legacy aliases such as `--soha-border`, `--soha-surface`, or `--soha-color-*`.
- Drive charts, progress strokes, timeline dots, graph edges, and status accents from Soha graph/state/text tokens instead of local hex color tables.
- Derive translucent success/warning/danger/info tints with `color-mix()` from Soha state tokens; do not add page-local `rgba(34, 197, 94, ...)`, `rgba(249, 115, 22, ...)`, or `rgba(239, 68, 68, ...)` status backgrounds.
- Drive terminal, logs, and noVNC dark surfaces through `--soha-terminal-*` tokens and `readTerminalThemeColors()`; do not put terminal background/foreground/cursor color fallbacks in feature components.
- Keep login and other brand/entry scenes visually distinct when needed, but derive their gradients, glass, state colors, shadows, and foreground colors from Soha tokens and `color-mix()` instead of local slate/sky/green hex or numeric rgba literals.
- Prefer current Ant Design 6 semantic APIs for visual props, such as `Card.styles.body` instead of `bodyStyle`, `Tag variant="filled"` instead of `bordered={false}` on antd `Tag`, and `Alert.title` instead of `Alert.message`.
- Do not reintroduce a neutral gray shadcn-like theme as the global visual direction.
- Reuse existing Soha page shells and management components before adding page-local styling.
- Keep scene exceptions, such as terminal, noVNC, charts, topology, DAG, and canvas editors, token-driven.

## Before Editing

1. Read the relevant existing files instead of inventing a new local pattern.
2. For antd component APIs, use the `antd` skill and query the local Ant Design CLI for the project version.
3. For theme, surface, management list/table, template designer, workflow canvas, graph, or AI workbench work, read `references/theme-system.md`.
4. Keep changes scoped. Do not move theme ownership out of `src/theme/app-theme.ts`, and do not add nested or secondary global `ConfigProvider` instances.

## Theme Ownership

Use this ownership model:

- `src/main.tsx`: the only global `ConfigProvider` entry.
- `src/theme/app-theme.ts`: exports antd theme config and writes Soha semantic CSS variables.
- `src/styles/globals.css`: global layout, header, sider, navigation, and page skeleton.
- `src/styles/shared-surfaces.css`: shared cards, context bars, stats, and page sections.
- `src/components/management-list.css`: management page query panels, panels, detail headers, and table shells.
- `src/components/admin-table.css`: default admin table skin.
- `src/features/*/*.css`: business semantics and real scene exceptions only.

## Component Direction

For normal management pages:

- Use `ManagementDataPage` as the default high-level shell when a page is structurally just page + optional header + query panel + admin table.
- Build query areas from `ManagementQueryPanel` and `ManagementQueryField`.
- Use `AdminTable` as the default table entry.
- Use `ManagementTableToolbar` for table actions and header extras.
- Prefer or introduce shared search helpers such as `ManagementKeywordField`, `ManagementToolbarSearch`, `useManagementTextFilter`, and `ManagementSearchableListPane` instead of repeating inline keyword input and filtering logic.
- Let `ManagementQueryPanel` / `ManagementQueryGrid` own responsive query collapse. Query fields should stay mounted; the shared grid decides whether fields fit in one row and only shows expand/collapse when the container actually wraps.
- Use `ManagementQueryActions` for normal reset/search actions. Only the submit action should be primary; reset and expand/collapse remain neutral.
- If one feature module owns several similar resource list pages, factor the repeated keyword query into a helper that returns `ManagementDataPage.query` and composes `ManagementKeywordField` with `ManagementQueryActions`.
- Use `useManagementTextFilter` for ordinary local keyword filtering in list/table pages. Keep exact enum/provider filters, log/code search, topology deferred search, and special multi-pane searches page-local when their semantics are different.
- Even when a page keeps a special multi-pane layout, such as Access Users with an organization tree, reuse `ManagementKeywordField` for ordinary keyword input unless the control semantics are materially different.

For template and workflow experiences:

- Consolidate Delivery template/Blueprint/Catalog editor layouts into a `TemplateDesignerShell` style pattern.
- Treat DAG, topology, and AI graph as scene exceptions, but drive them through shared workflow/canvas tokens.
- Prefer a reusable `WorkflowCanvasSurface` convention for canvas background, grid, controls, node cards, selected states, inspector surfaces, and edge colors.

For the AI workbench:

- Keep Ant Design X components as the chat/workbench base: `Conversations`, `Welcome`, `Prompts`, `Bubble.List`, `Sender`, and `ThoughtChain`.
- Prefer a `SohaAIWorkbenchShell` style separation: page owns data and actions; shell owns layout, surfaces, density, empty states, and responsive behavior.
- Use XRequest only for AI streaming/provider requests, not as a replacement for normal CRUD clients.
- Browser code must call same-origin backend proxy paths, such as `/api/ai/workbench/chat`.
- Never put `Authorization`, provider tokens, API keys, or model credentials in browser XRequest config.

## Validation

After implementing frontend changes, run the narrowest useful checks for the touched area. Prefer at least typecheck or targeted tests when changing TypeScript, and inspect rendered pages when changing visual surfaces or layout.

## Reference

Read `references/theme-system.md` when work touches theme variables, CSS surfaces, management tables/search, Delivery template designers, DAG/workflow canvas, AI graph, or AI workbench request architecture.
