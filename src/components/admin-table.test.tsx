/** @vitest-environment jsdom */

import type { ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { AdminTable } from './admin-table'
import { tableColumnPresets } from '@/utils/table-columns'

const captured = vi.hoisted(() => ({
  tableProps: null as any,
}))

vi.mock('antd', () => ({
  Alert: ({ description, message }: { description?: ReactNode; message?: ReactNode }) => <div>{message}{description}</div>,
  Button: ({ children, ...props }: { children?: ReactNode }) => <button {...props}>{children}</button>,
  Checkbox: {
    Group: () => <div data-testid="checkbox-group" />,
  },
  Empty: Object.assign(
    ({ children, description }: { children?: ReactNode; description?: ReactNode }) => <div>{description}{children}</div>,
    { PRESENTED_IMAGE_SIMPLE: 'simple-empty' },
  ),
  Form: {
    Item: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  },
  Popover: ({ children }: { children?: ReactNode }) => <>{children}</>,
  Space: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Table: (props: any) => {
    captured.tableProps = props
    return <div data-testid="table-proxy" />
  },
  Tooltip: ({ children }: { children?: ReactNode }) => <>{children}</>,
  Typography: {
    Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  },
}))

let containers: HTMLDivElement[] = []
let roots: Array<ReturnType<typeof createRoot>> = []

async function renderNode(node: ReactNode) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  containers.push(container)

  const root = createRoot(container)
  roots.push(root)

  await act(async () => {
    root.render(<>{node}</>)
  })

  return container
}

describe('AdminTable', () => {
  beforeAll(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  })

  afterEach(async () => {
    captured.tableProps = null
    await act(async () => {
      for (const root of roots) {
        root.unmount()
      }
    })
    roots = []
    for (const container of containers) {
      container.remove()
    }
    containers = []
  })

  it('derives a default horizontal scroll width from active columns', async () => {
    await renderNode(
      <AdminTable
        columns={[
          { title: 'A', dataIndex: 'a', width: 220 },
          { title: 'B', dataIndex: 'b', width: 180 },
          { title: 'C', dataIndex: 'c' },
        ]}
        dataSource={[{ id: '1', a: 'a', b: 'b', c: 'c' }]}
        rowKey="id"
      />,
    )

    expect(captured.tableProps?.scroll).toEqual({ x: 960, y: undefined })
    expect(captured.tableProps?.size).toBe('small')
    expect(captured.tableProps?.pagination).toMatchObject({
      current: 1,
      pageSize: 10,
      showLessItems: true,
      showSizeChanger: true,
      size: 'small',
    })
  })

  it('keeps an explicit horizontal scroll width when provided', async () => {
    await renderNode(
      <AdminTable
        columns={[{ title: 'A', dataIndex: 'a', width: 220 }]}
        dataSource={[{ id: '1', a: 'a' }]}
        rowKey="id"
        scroll={{ x: 1440 }}
      />,
    )

    expect(captured.tableProps?.scroll).toEqual({ x: 1440, y: undefined })
  })

  it('passes pagination summary into Ant Design showTotal', async () => {
    await renderNode(
      <AdminTable
        columns={[{ title: 'A', dataIndex: 'a', width: 220 }]}
        dataSource={[{ id: '1', a: 'a' }]}
        paginationSummary="当前 1 / 3 条"
        rowKey="id"
      />,
    )

    expect(captured.tableProps?.pagination.showTotal(1, [1, 1])).toBe('当前 1 / 3 条')
  })

  it('pins the shared action preset to the right side', () => {
    expect(tableColumnPresets.action.fixed).toBe('right')
  })

  it('normalizes legacy action columns through the shared table contract', async () => {
    await renderNode(
      <AdminTable
        columns={[
          { title: '名称', dataIndex: 'name' },
          { title: '操作', key: 'actions', fixed: 'right', width: 180, render: () => null },
        ]}
        dataSource={[{ id: '1', name: 'demo' }]}
        rowKey="id"
      />,
    )

    const actionColumn = captured.tableProps.columns[1]
    expect(actionColumn).toMatchObject({
      title: '',
      fixed: 'right',
      align: 'center',
      minWidth: 52,
      width: undefined,
    })
    expect(actionColumn.className).toContain('soha-table-actions-column')
    expect(actionColumn.className).toContain('soha-table-actions-column--auto')
    expect(actionColumn.onHeaderCell().className).toContain('soha-table-actions-column--auto')
    expect(actionColumn.onCell({}, 0).className).toContain('soha-table-actions-column--auto')
  })

  it('keeps business action data as a regular visible column', async () => {
    await renderNode(
      <AdminTable
        columns={[{ title: '动作', dataIndex: 'actions', render: () => null }]}
        dataSource={[{ id: '1', actions: ['view'] }]}
        rowKey="id"
      />,
    )

    expect(captured.tableProps.columns[0]).toMatchObject({
      title: '动作',
      dataIndex: 'actions',
    })
    expect(captured.tableProps.columns[0].fixed).toBeUndefined()
  })

  it('keeps action columns visible and out of column selection', async () => {
    const container = await renderNode(
      <AdminTable
        columns={[
          { title: '名称', dataIndex: 'name' },
          { title: '状态', dataIndex: 'status' },
          { title: '操作', key: 'actions', fixed: 'right', render: () => null },
        ]}
        dataSource={[{ id: '1', name: 'demo', status: 'ready' }]}
        rowKey="id"
      />,
    )

    expect(captured.tableProps.columns).toHaveLength(3)
    expect(captured.tableProps.columns[2].fixed).toBe('right')
    expect(container.textContent).not.toContain('操作')
  })

  it('preserves explicit K8s action widths while hiding the column title', async () => {
    await renderNode(
      <AdminTable
        columns={[
          {
            title: '操作',
            key: 'actions',
            fixed: 'right',
            width: 112,
            onHeaderCell: () => ({ className: 'soha-table-actions-column k8s-actions' }),
            render: () => null,
          },
        ]}
        dataSource={[{ id: '1' }]}
        rowKey="id"
      />,
    )

    const actionColumn = captured.tableProps.columns[0]
    expect(actionColumn.title).toBe('')
    expect(actionColumn.width).toBe(112)
    expect(actionColumn.className).not.toContain('soha-table-actions-column--auto')
    expect(actionColumn.onHeaderCell().className).toContain('k8s-actions')
  })
})
