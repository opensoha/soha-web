export const MENU_SECTION_ORDER = ['platform', 'ops', 'delivery', 'delivery-records', 'delivery-platform', 'catalog', 'admin'] as const

export type MenuSectionKey = (typeof MENU_SECTION_ORDER)[number]

const MENU_SECTION_LABELS: Record<MenuSectionKey, { zh: string; en: string }> = {
  platform: { zh: 'Dashboard', en: 'Dashboard' },
  ops: { zh: 'Observe', en: 'Observe' },
  delivery: { zh: '应用交付', en: 'Delivery' },
  'delivery-records': { zh: '交付记录', en: 'Delivery Records' },
  'delivery-platform': { zh: '平台配置', en: 'Platform Configuration' },
  catalog: { zh: 'Catalog', en: 'Catalog' },
  admin: { zh: 'Admin', en: 'Admin' },
}

const MENU_SECTION_ALIASES: Record<string, MenuSectionKey> = {
  platform: 'platform',
  dashboard: 'platform',
  ops: 'ops',
  observe: 'ops',
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
  return Array.from(
    new Set(
      sections
        .map((item) => normalizeMenuSection(item))
        .filter(Boolean),
    ),
  )
    .sort((left, right) => {
      const sectionOrder = getMenuSectionOrder(left) - getMenuSectionOrder(right)
      if (sectionOrder !== 0) return sectionOrder
      return resolveMenuSectionLabel(left, localeCode).localeCompare(resolveMenuSectionLabel(right, localeCode))
    })
    .map((value) => ({
      value,
      label: resolveMenuSectionLabel(value, localeCode),
    }))
}
