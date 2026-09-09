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

## Navigation Icons

- Runtime sidebar icons come from the server menu `iconKey` and resolve through
  `src/features/system/menu-icons.tsx`; change built-in defaults in the backend menu seed and
  idempotent upgrader, not in route-local icon metadata.
- Choose icons for the primary operator task. Within one sibling group, avoid reusing the same
  rendered glyph for unrelated actions when a clearer registered icon exists; reuse the shared
  registry and installed icon set before adding assets or dependencies.
- Preserve administrator customization: a default migration may replace the prior default icon
  key, but must not overwrite an arbitrary persisted icon key.

## Workbench Overviews

- Support two overview templates only. Standard management overviews use summary metrics, the
  shared summary grid, then runtime or operational detail. The AI compact overview uses summary
  metrics followed directly by the shared chip grid. The portal application launcher is a
  separate scene, not an overview template.
- Use `OverviewMetricCard` and `OverviewChip` inside the shared overview grids. The grids assign a
  stable blue, cyan, violet, and teal category sequence; feature pages must not add their own
  card palettes or use status tones as decoration.
- Give every top-level standard-overview panel one native Ant Design `Card` `title` and optional
  `extra`. Use `OverviewSectionBar` only to divide content inside an already titled card; never
  replace or duplicate the card title with it.
- Shared overview CSS owns the page gap, summary ratio, metric/chip/pod columns, responsive
  breakpoints, radii, and accent sequence. Feature CSS may constrain or scroll domain content,
  but must not override that macro geometry.
- Do not repeat the route title in a page header when the breadcrumb already identifies the
  overview.
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

## Management Tables

- `ManagementDataPage` is the query/page shell, `AdminTable` is the shared table, and Ant Design
  `Table` is its implementation, not three competing designs. New management tables use this
  stack; migrate existing raw tables without introducing another wrapper.
- Embedded tables use `AdminTable` directly, with `pagination={false}` and
  `enableColumnSelection={false}` when those controls are unnecessary. Preserve expansion,
  row keys, fixed columns, and callbacks; do not add a page query shell to an embedded list.
- Top-level lists retain the pagination footer and total/range summary. Cursor APIs must retain
  their real navigation semantics: do not invent totals or replace the footer with toolbar arrows.
- Table tokens in `src/theme/app-theme.ts` own header text (`colorText`), header background
  (`colorBgMuted`), and header split (`colorBorder`). Shared table CSS sets header weight to 600.
  Field separation means vertical short separators between column headers, not stronger
  horizontal row borders or a full bordered grid. Do not add page-local divider overrides.
- Expose compact (`small`, 8 px vertical padding) and comfortable (`middle`, 12 px) density;
  both use 12 px horizontal padding. Keep padding in shared tokens, not per-page CSS.
- Reuse `src/utils/table-columns.ts` presets for status, time, and actions. Names stay text/links;
  metadata is secondary and actions stay predictably placed. Long identifiers remain accessible
  through wrapping, copying, or a tooltip rather than irreversible clipping.
- Fill available content width; use deliberate horizontal scrolling for wide datasets instead of
  page-local fixed maximum widths. List/Card remains appropriate for browse-and-open tasks;
  unification does not mean every list must become a table.

## Tag Semantics

- `src/components/status-tag.tsx` owns the compact `filled` treatment: `StatusTag` for
  lifecycle/health/result/severity, `MetadataTag` for categories, `BooleanTag` for boolean labels.
  Do not add page-local palettes, outlined variants, or global `.ant-tag` color overrides.
- Resolve status color from canonical values, not translated text: success/healthy green,
  failure/denial red, warning/approval orange, processing blue, unknown/inactive neutral. Check
  the shared map before adding values. A healthy running workload is not a running task;
  do not recolor every `running` value as processing.
- Metadata colors are stable by field meaning, never random by value or index:

  | Meaning | Tone |
  | --- | --- |
  | Role | `purple` |
  | Organization | `cyan` |
  | Login/mapping/session source; permission/action category | `blue` |
  | Counts, overflow `+N`, ordinary IDs, absent metadata | `default` |

- A source/provider is not a success result. Reuse `src/utils/login-provider.ts` for login
  labels/tones. Permission names are metadata; actual allow/deny decisions are statuses.
  Unknown status values remain neutral with their text preserved.
- Keep primary identities as text/links. Routine addresses, versions, and specifications do not
  automatically need colored tags; category color must help scanning.
- Do not repeat information with decorative row icons, provider-colored side borders, or accent
  rails when the same provider or resource type is already visible as text or a tag.
- Keep each tag single-line. Small groups may wrap at the container; large table collections
  need a compact summary and keyboard-accessible expansion. Access tables reuse
  `src/features/access/shared/compact-mapped-tags.tsx`: default two visible values, neutral `+N`,
  and the same tone in summary and expansion. Do not deep-import this feature-private helper
  elsewhere; promote it only when cross-feature reuse is actually needed.

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
- Resetting a query should return the grid to the collapsed baseline when collapse is available.

## Exceptions

- Keep login, terminal, noVNC, DAG, topology, AI graph, and AI workbench scene-specific, but still token-driven.
- Keep Access Users and other true multi-pane pages on shared query/search components whenever ordinary keyword input is involved.
- Do not add page-local `ConfigProvider` instances or page-local global theme overrides.
