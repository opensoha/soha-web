/** @vitest-environment jsdom */

import { act } from 'react'
import { App as AntdApp } from 'antd'
import { createRoot } from 'react-dom/client'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { LogDataSourcesPage } from './data-sources-page'

const mutation = { isPending: false, mutate: vi.fn(), variables: undefined }

vi.mock('@tanstack/react-query', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-query')>()),
  useMutation: () => mutation,
  useQueryClient: () => ({}),
  useQuery: (options: { kind: string }) =>
    options.kind === 'sources'
      ? {
          data: [
            {
              enabled: true,
              id: 'logs-main',
              validationMessage: 'backend query timed out',
              validationStatus: 'failed',
            },
          ],
          isError: false,
          isLoading: false,
        }
      : { data: [], isError: false, isLoading: false },
}))
vi.mock('./queries', () => ({
  observabilityLogQueries: { dataSources: () => ({ kind: 'sources' }) },
}))
vi.mock('../provider-queries', () => ({
  observabilityProviderQueries: { providers: () => ({ kind: 'providers' }) },
}))
vi.mock('./mutations', () => ({
  observabilityLogMutations: {
    createDataSource: () => ({}),
    updateDataSource: () => ({}),
    validateDataSource: () => ({}),
  },
}))
vi.mock('@/features/auth', () => ({
  hasPermission: () => false,
  usePermissionSnapshot: () => ({ data: { data: {} } }),
}))
vi.mock('@/components/status-tag', () => ({
  BooleanTag: ({ trueLabel }: { trueLabel: string }) => <span>{trueLabel}</span>,
  StatusTag: ({ value }: { value?: string }) => <span>{value}</span>,
}))
vi.mock('@/components/admin-table', () => ({
  AdminTable: ({ columns, dataSource }: any) => {
    const column = columns.find((item: any) => item.key === 'status')
    return (
      <div>
        {column.title}
        {column.render(undefined, dataSource[0], 0)}
      </div>
    )
  },
}))

beforeAll(() => vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true))

describe('LogDataSourcesPage validation evidence', () => {
  it('shows the backend validation failure reason beside status', async () => {
    const container = document.createElement('div')
    const root = createRoot(container)

    await act(async () =>
      root.render(
        <AntdApp>
          <LogDataSourcesPage />
        </AntdApp>,
      ),
    )

    expect(container.textContent).toContain('failed')
    expect(container.textContent).toContain('backend query timed out')

    await act(async () => root.unmount())
  })
})
