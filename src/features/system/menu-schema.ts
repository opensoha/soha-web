export const MENU_SECTION_ORDER = [
  'account',
  'provider',
  'integrations',
  'users',
  'operations',
  'extensions',
  'platform',
  'ops',
  'ai-interaction',
  'ai-engineering',
  'ai-model-access',
  'ai-governance',
  'delivery',
  'delivery-records',
  'delivery-platform',
  'catalog',
  'admin',
] as const

export type MenuSectionKey = (typeof MENU_SECTION_ORDER)[number]

const MENU_SECTION_LABELS: Record<MenuSectionKey, { zh: string; en: string }> = {
  account: { zh: '基础', en: 'Basics' },
  provider: { zh: '提供商', en: 'Providers' },
  integrations: { zh: '系统集成', en: 'System Integrations' },
  users: { zh: '用户权限', en: 'Users & Access' },
  operations: { zh: '系统运维', en: 'System Operations' },
  extensions: { zh: '扩展', en: 'Extensions' },
  platform: { zh: 'Dashboard', en: 'Dashboard' },
  ops: { zh: 'Observe', en: 'Observe' },
  'ai-interaction': { zh: '交互', en: 'Interaction' },
  'ai-engineering': { zh: 'AI 工程', en: 'AI Engineering' },
  'ai-model-access': { zh: '模型与接入', en: 'Models & Access' },
  'ai-governance': { zh: '治理与可观测', en: 'Governance & Observability' },
  delivery: { zh: '应用交付', en: 'Delivery' },
  'delivery-records': { zh: '交付记录', en: 'Delivery Records' },
  'delivery-platform': { zh: '平台配置', en: 'Platform Configuration' },
  catalog: { zh: 'Catalog', en: 'Catalog' },
  admin: { zh: '管理', en: 'Admin' },
}

const MENU_SECTION_ALIASES: Record<string, MenuSectionKey> = {
  account: 'account',
  basic: 'account',
  basics: 'account',
  provider: 'provider',
  providers: 'provider',
  integration: 'integrations',
  integrations: 'integrations',
  'system-integration': 'integrations',
  'system-integrations': 'integrations',
  users: 'users',
  user: 'users',
  access: 'users',
  operations: 'operations',
  operation: 'operations',
  system: 'operations',
  extension: 'extensions',
  extensions: 'extensions',
  platform: 'platform',
  dashboard: 'platform',
  ops: 'ops',
  observe: 'ops',
  interaction: 'ai-interaction',
  'ai-interaction': 'ai-interaction',
  'ai-engineering': 'ai-engineering',
  'model-access': 'ai-model-access',
  'ai-model-access': 'ai-model-access',
  governance: 'ai-governance',
  'ai-governance': 'ai-governance',
  'ai-operations': 'ai-governance',
  'production-operations': 'ai-governance',
  deliver: 'delivery',
  delivery: 'delivery',
  'delivery-record': 'delivery-records',
  'delivery-records': 'delivery-records',
  records: 'delivery-records',
  'delivery-platform': 'delivery-platform',
  'platform-config': 'delivery-platform',
  catalog: 'catalog',
  admin: 'admin',
}

export function normalizeMenuSection(section: string) {
  const trimmed = String(section || '').trim()
  if (!trimmed) return ''
  return MENU_SECTION_ALIASES[trimmed.toLowerCase()] ?? trimmed
}

export function getMenuSectionOrder(section: string) {
  const normalized = normalizeMenuSection(section) as MenuSectionKey
  const index = MENU_SECTION_ORDER.indexOf(normalized)
  return index >= 0 ? index : Number.MAX_SAFE_INTEGER
}

export function resolveMenuSectionLabel(section: string, localeCode: 'zh_CN' | 'en_US' = 'zh_CN') {
  const normalized = normalizeMenuSection(section) as MenuSectionKey
  const labels = MENU_SECTION_LABELS[normalized]
  if (!labels) return section || 'unknown'
  return localeCode === 'en_US' ? labels.en : labels.zh
}

export function buildMenuSectionOptions(
  sections: string[],
  localeCode: 'zh_CN' | 'en_US' = 'zh_CN',
) {
  return Array.from(new Set(sections.map((item) => normalizeMenuSection(item)).filter(Boolean)))
    .sort((left, right) => {
      const sectionOrder = getMenuSectionOrder(left) - getMenuSectionOrder(right)
      if (sectionOrder !== 0) return sectionOrder
      return resolveMenuSectionLabel(left, localeCode).localeCompare(
        resolveMenuSectionLabel(right, localeCode),
      )
    })
    .map((value) => ({
      value,
      label: resolveMenuSectionLabel(value, localeCode),
    }))
}
