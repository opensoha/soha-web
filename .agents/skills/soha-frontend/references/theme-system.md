# Soha Web Theme System

This reference is the concise operating standard for `soha-web` theme, layout, management tables/search, templates, workflow canvas, and AI workbench work.

## Core Standard

- Use Ant Design 6 as the base component system.
- Keep exactly one app-level `ConfigProvider` in `src/main.tsx`.
- Treat `src/theme/app-theme.ts` as the source of truth for antd tokens and Soha CSS variables.
- Keep the light theme global base/layout background white: `colorBgBase`, `colorBgLayout`, `--soha-bg-base`, and `--soha-bg-layout` must resolve to `#ffffff`.
- Use Soha semantic variables instead of page-local hardcoded colors and shadows.
- Keep shape tokens split by purpose: `--soha-radius-control` for inputs/buttons/list items, `--soha-radius-panel` for cards/query panels/detail headers/table shells, and `--soha-radius-lg` for larger scene containers.
- Keep management search width token-driven through `--soha-management-query-field-default-width` and `--soha-management-toolbar-search-width`; narrow pages must adapt through shared component responsiveness, not page-local width variants.

## Shared Components

- `ManagementDataPage` is the default shell for ordinary management list pages.
- `ManagementQueryPanel`, `ManagementQueryField`, `ManagementQueryScope`, `ManagementKeywordField`, `ManagementQueryActions`, `ManagementToolbarSearch`, `ManagementSearchableListPane`, `ManagementTableToolbar`, and `AdminTable` are the primary shared building blocks.
- `ManagementQueryPanel` / `ManagementQueryGrid` own responsive query collapse. Query fields must stay mounted; the shared grid decides whether fields fit in one row and only shows expand/collapse when the container actually wraps.
- `ManagementQueryActions` is the default reset/search button group. Only the submit action should be primary; reset and expand/collapse remain neutral.
- `ManagementKeywordField` is the default main query keyword field.
- `ManagementToolbarSearch` is the default compact headerExtra filter search.
- `ManagementSearchableListPane` is the default searchable left list.
- Use the shared `soha-form-segmented` treatment for a fixed set of two to six mutually exclusive
  form modes. Keep it block-width when the modes define the form below, and never add page-local
  selected colors; query filters still belong in `ManagementQueryScope`.
- Step-form modals and deliberately chrome-light nested form modals may visually hide a repeated
  title with `visuallyHiddenModalTitleStyle`, but must keep the semantic `title` so the dialog
  remains named for assistive technology. Ordinary management modals retain a concise visible
  title.

## Surface Rules

- Card, QueryPanel, DetailHeader, and table shells must share one panel radius.
- Table header top corners must match the table shell radius.
- Query inputs and toolbar searches should read as white surfaces in light mode.
- Ordinary management buttons in query areas should stay neutral; only the core submit action should use the theme color.

## Workbench Overviews

- Use `OverviewMetricCard` and `OverviewChip` inside the shared overview grids. The grids assign a
  stable blue, cyan, violet, and teal category sequence; feature pages must not add their own
  card palettes or use status tones as decoration.
- Order the page as summary metrics, then scoped operational detail. Use `OverviewSectionBar` for
  compact section identity and shared neutral panel classes for grouped detail; do not repeat the
  route title in a page header when the breadcrumb already identifies the overview.
- Shared overview CSS owns four/three/two/one-column responsiveness. Feature CSS may position a
  domain scene, but must not redefine overview card columns, spacing, radii, or accent sequences.
- Keep category color restrained: a light token-derived surface plus colored icon and 2 px bottom
  rail. Ordinary overview panels and tables remain neutral surfaces.
- `tone="success"` changes only the bottom rail so healthy cards retain their category identity.
  `warning` and `danger` override the card accent and tint because they require operator attention.
- Use theme variables and `color-mix()` so the same rules work in light and dark modes. Do not
  hard-code overview colors in feature CSS.
- Render loading per independently fetched summary. Distinguish true empty, error, and
  no-permission states instead of collapsing all three to zero; expose retry when a failed query
  controls the whole section.
- Wrap navigable cards in semantic links or buttons, retain visible `:focus-visible`, and include a
  text or icon label for status so color is never the only signal.

### AI And Delivery Overviews

- AI overview cards summarize permission-scoped interaction, knowledge, provider, and gateway
  data on shared surfaces. Chat, graph, and streaming runtime views remain token-driven scene
  exceptions and must expose loading, empty, error, retry, and streaming state explicitly.
- Delivery overview cards summarize applications, environments, release flow, and execution
  evidence. Use success, warning, and danger only for lifecycle meaning; release, rollback, retry,
  and approval commands remain explicit and confirmation-gated.

## Tags And Pagination

- Use `StatusTag` for stateful values and `MetadataTag` for categorical labels. Both use compact
  Ant Design `filled` tags with semantic colors; ordinary management pages must not add outlined
  tag variants or local color maps.
- In scan-heavy tables, keep the primary identity as text or a link, then use a small number of
  colored tags for provider, location, address, and specification metadata. Limit each color to a
  stable meaning and summarize overflowing values instead of widening rows indefinitely.
- Do not repeat information with decorative row icons, provider-colored side borders, or accent
  rails when the same provider or resource type is already visible as text or a tag.
- Wrap groups of tags at the collection level while keeping each tag on one line. Large value
  sets need an overflow or summary treatment instead of unbounded table-row growth.
- Top-level `AdminTable` lists keep the shared pagination footer and summary, including when the
  backend uses cursors. Toolbar previous/next buttons do not replace the footer. Disable
  pagination only for intentional embedded tables.

## Management Table Toolbars

- Keep toolbar controls at the global control height and vertically centered inside the shared
  compact toolbar rhythm. Use `ManagementTableToolbar`; do not set page-local button heights.
- Keep the toolbar and table header as one continuous panel surface. Do not add a divider between
  them unless the toolbar contains a distinct titled section rather than ordinary list actions.

## Detail Overviews

- Use one restrained overview panel before logs, tasks, metrics, and console content. Start with
  resource identity and compact provider/status tags, then group fields by operator task such as
  runtime hardware, network identity, and initialization/source.
- Use `Descriptions` or an equivalent responsive grid for label-value alignment. Render status
  with `StatusTag`, categorical values with `MetadataTag`, and long identifiers as selectable or
  wrap-safe text.
- Add depth with the shared panel radius and shadow only. Do not add provider-colored side rails,
  oversized resource icons, nested cards, or decorative elements that duplicate visible metadata.
- Show unavailable values as `-`; show actionable collection limitations with a compact `Alert`
  near the affected section rather than hiding missing data.

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
- Detail pages must not repeat the current application or resource name, generic explanatory
  copy, or a back-to-list action below a breadcrumb that already provides that identity and
  navigation. Keep a dedicated detail header only when it adds workspace context or cross-page
  actions that the breadcrumb, tabs, and surrounding management surface cannot represent.
- Keep K8s workload mutation commands such as restart and scale in the management list table's
  row or batch actions instead of the detail tab bar.

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
