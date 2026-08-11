import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { TableCellLink, TableCellText } from './table-cell-content'

vi.mock('antd', () => ({
  Button: ({ children }: { children?: ReactNode }) => <button>{children}</button>,
  Tooltip: ({ children, title }: { children?: ReactNode; title?: ReactNode }) => (
    <span data-tooltip={title}>{children}</span>
  ),
  Typography: { Text: ({ children }: { children?: ReactNode }) => <span>{children}</span> },
}))

describe('table cell content', () => {
  it('keeps the displayed text and tooltip text aligned', () => {
    expect(renderToStaticMarkup(<TableCellText value="long-value" />)).toContain(
      'data-tooltip="long-value"',
    )
    expect(renderToStaticMarkup(<TableCellText value="" />)).toContain('data-tooltip="-"')
    expect(
      renderToStaticMarkup(<TableCellLink label="resource-name" onClick={() => undefined} />),
    ).toContain('data-tooltip="resource-name"')
  })
})
