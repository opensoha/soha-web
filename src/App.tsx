import { lazy, Suspense, useLayoutEffect } from 'react'
import { Spin } from 'antd'
import { AppErrorBoundary } from './components/app-error-boundary'
import { AppRouter } from './routes'
import { usePreferencesStore } from './stores/preferences-store'
import { applyAppTheme, DEFAULT_APP_THEME_ID, watchSystemThemeMode } from './theme/app-theme'

const DesktopRouter = lazy(async () => {
  const module = await import('./features/desktop/desktop-router')
  return { default: module.DesktopRouter }
})

export default function App() {
  const themeMode = usePreferencesStore((state) => state.themeMode)

  useLayoutEffect(() => {
    applyAppTheme(DEFAULT_APP_THEME_ID, themeMode)
  }, [themeMode])

  useLayoutEffect(() => {
    if (themeMode !== 'system') {
      return undefined
    }
    return watchSystemThemeMode(() => applyAppTheme(DEFAULT_APP_THEME_ID, themeMode))
  }, [themeMode])

  return (
    <AppErrorBoundary>
      {import.meta.env.MODE === 'app' ? (
        <Suspense
          fallback={
            <div className="flex min-h-screen items-center justify-center">
              <Spin size="large" />
            </div>
          }
        >
          <DesktopRouter />
        </Suspense>
      ) : (
        <AppRouter />
      )}
    </AppErrorBoundary>
  )
}
