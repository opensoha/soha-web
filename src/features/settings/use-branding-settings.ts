import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth-store'
import type { BrandingSettings } from '@/types'
import {
  defaultBrandingSettings,
  normalizeBrandingSettings,
  readStoredBrandingSettings,
} from '@/utils/branding'
import { settingsQueries } from './queries'

export function useBrandingSettings() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated())
  const fallback = readStoredBrandingSettings()
  const query = useQuery(settingsQueries.branding(isAuthenticated))
  return {
    ...query,
    data: { data: query.data ?? fallback ?? defaultBrandingSettings },
  }
}

export function getNormalizedBranding(value?: BrandingSettings | null) {
  return normalizeBrandingSettings(value ?? defaultBrandingSettings)
}
