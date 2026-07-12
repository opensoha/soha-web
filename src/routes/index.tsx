import { Route, Routes } from 'react-router-dom'
import { AuthGuard } from '@/features/auth/auth-guard'
import { AppLayout } from '@/layouts/app-layout'
import { renderRegisteredRoutes } from './router'

export function AppRouter() {
  return (
    <Routes>
      {renderRegisteredRoutes('public')}
      <Route element={<AuthGuard />}>
        {renderRegisteredRoutes('portal')}
        <Route element={<AppLayout />}>{renderRegisteredRoutes('app')}</Route>
      </Route>
    </Routes>
  )
}
