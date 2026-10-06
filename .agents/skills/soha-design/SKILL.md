---
name: soha-design
description: Design or review Soha Web page organization, hierarchy, density and interaction semantics. Use for UI design changes; implementation also follows soha-frontend. Copy-only maintenance does not start a redesign.
---

# Soha Design

Read [product experience](references/product-experience.md) for the affected scene and
[theme ownership](../soha-frontend/references/theme-system.md) for tokens. Actual values live
in `src/theme/app-theme.ts`; existing pages and screenshots are evidence, not approved samples.

Identify the task, object, important state, main action and supporting facts before composing
controls. Keep Ant Design and reuse mature capabilities while preserving API, permissions,
query and professional engine lifecycle. The current task determines scope; no fixed pilot pages.

Validate actual light/dark pages, long values, narrow views, loading/empty/error/permission
states, mouse and keyboard separately. Use soha-web-testing for executable evidence. Produce
candidate screenshots when approval is missing; never update accepted baselines or sign user
approval to make a check green. Report design gaps separately from compilation and test results.
