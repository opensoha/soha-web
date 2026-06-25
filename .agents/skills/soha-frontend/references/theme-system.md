# Soha Web Theme System

This reference is the concise operating standard for `soha-web` theme, layout, management tables/search, templates, workflow canvas, and AI workbench work.

## Core Standard

- Use Ant Design 6 as the base component system.
- Keep exactly one app-level `ConfigProvider` in `src/main.tsx`.
- Treat `src/theme/app-theme.ts` as the source of truth for antd tokens and Soha CSS variables.
- Keep the light theme global base/layout background white: `colorBgBase`, `colorBgLayout`, `--soha-bg-base`, and `--soha-bg-layout` must resolve to `#ffffff`.
- Use Soha semantic variables instead of page-local hardcoded colors and shadows.
- Keep shape tokens split by purpose: `--soha-radius-control` for inputs/buttons/list items, `--soha-radius-panel` for cards/query panels/detail headers/table shells, and `--soha-radius-lg` for larger scene containers.
- Keep management search width token-driven: `--soha-management-query-field-default-width` and `--soha-management-toolbar-search-width` are the default search widths (currently 300px); narrow pages must adapt through shared component responsiveness, not page-local `220/240/260px` search widths.

## Shared Components

- `ManagementDataPage` is the default shell for ordinary management list pages.
- `ManagementQueryPanel`, `ManagementQueryField`, `ManagementKeywordField`, `ManagementQueryActions`, `ManagementToolbarSearch`, `ManagementSearchableListPane`, `ManagementTableToolbar`, and `AdminTable` are the primary shared building blocks.
- `ManagementQueryPanel` / `ManagementQueryGrid` own responsive query collapse. Query fields must stay mounted; the shared grid decides whether fields fit in one row and only shows expand/collapse when the container actually wraps.
- `ManagementQueryActions` is the default reset/search button group. Only the submit action should be primary; reset and expand/collapse remain neutral.
- `ManagementKeywordField` is the default main query keyword field.
- `ManagementToolbarSearch` is the default compact headerExtra filter search.
- `ManagementSearchableListPane` is the default searchable left list.

## Surface Rules

- Card, QueryPanel, DetailHeader, and table shells must share one panel radius.
- Table header top corners must match the table shell radius.
- Query inputs and toolbar searches should read as white surfaces in light mode.
- Ordinary management buttons in query areas should stay neutral; only the core submit action should use the theme color.

## Shared Query Behavior

- Keep all query fields mounted in the DOM.
- Let the shared grid decide whether the row wraps.
- If everything fits in one row, do not show expand/collapse.
- If the fields wrap to a second row, show the expand button.
- Resetting a query should return the grid to the collapsed baseline when collapse is available.

## Exceptions

- Keep login, terminal, noVNC, DAG, topology, AI graph, and AI workbench scene-specific, but still token-driven.
- Keep Access Users and other true multi-pane pages on shared query/search components whenever ordinary keyword input is involved.
- Do not add page-local `ConfigProvider` instances or page-local global theme overrides.
