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
- `ManagementQueryPanel`, `ManagementQueryField`, `ManagementQueryScope`, `ManagementKeywordField`, `ManagementQueryActions`, `ManagementToolbarSearch`, `ManagementSearchableListPane`, `ManagementTableToolbar`, and `AdminTable` are the primary shared building blocks.
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

## Tags And Pagination

- Use `StatusTag` for stateful values and `MetadataTag` for categorical labels. Both use compact
  Ant Design `filled` tags with semantic colors; ordinary management pages must not add outlined
  tag variants or local color maps.
- Wrap groups of tags at the collection level while keeping each tag on one line. Large value
  sets need an overflow or summary treatment instead of unbounded table-row growth.
- Top-level `AdminTable` lists keep the shared pagination footer and summary, including when the
  backend uses cursors. Toolbar previous/next buttons do not replace the footer. Disable
  pagination only for intentional embedded tables.

## Resource Tabs

- Use the shared `soha-resource-tabs` class for peer resource categories and resource-detail
  content views. Keep the compact 13px label, 600 active weight, 2px centered indicator, and
  token-driven divider treatment consistent across workbenches.
- Add `is-header-only` when Tabs only selects the dataset and the page owns the content below it;
  omit it when each tab item owns a content panel.
- Do not use resource Tabs for shortcuts that filter one dataset. Those belong in
  `ManagementQueryScope` inside the query panel.

## Breadcrumbs

- Detail pages must preserve the navigable list-route ancestor and use the decoded resource
  identifier from the final dynamic path segment as the terminal breadcrumb. Do not expose a
  generic `Detail` label when a stable route parameter is available.
- Keep workbench, menu-group, and menu labels sourced from the runtime navigation. Route-only
  ancestors use their route titles so a shared menu ID does not collapse distinct list levels.
- Standard K8s resource detail pages must not repeat the resource kind and name below a
  breadcrumb that already identifies the resource. Keep workload mutation commands such as
  restart and scale in the management list table's row or batch actions instead of the detail
  tab bar. Keep a dedicated detail header only when it carries additional workspace context or
  cross-page actions that the breadcrumb and tabs cannot represent.

## Shared Query Behavior

- Keep all query fields mounted in the DOM.
- Use `ManagementQueryScope` for a stable set of two to six single-select shortcuts that filter
  one dataset. It must remain one intrinsic-width layout unit: never shrink, wrap, split, or
  truncate its Segmented options. Use a Select for longer, dynamic, or larger option sets.
- Label quick filters by their meaning, such as `业务域`, `日志范围`, or `快捷范围`. Reserve
  `视图` for changes in presentation such as list, tree, timeline, or saved query layouts.
- Let the shared grid decide whether the row wraps.
- If everything fits in one row, do not show expand/collapse.
- If the fields wrap to a second row, show the expand button.
- Resetting a query should return the grid to the collapsed baseline when collapse is available.

## Exceptions

- Keep login, terminal, noVNC, DAG, topology, AI graph, and AI workbench scene-specific, but still token-driven.
- Keep Access Users and other true multi-pane pages on shared query/search components whenever ordinary keyword input is involved.
- Do not add page-local `ConfigProvider` instances or page-local global theme overrides.
