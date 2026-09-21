import assert from 'node:assert/strict'
import { test } from 'vitest'
import { newViolations, scanTableImports } from './check-table-boundaries.mjs'

const file = 'src/features/example/page.tsx'

for (const [name, source] of Object.entries({
  named: "import { Table } from 'antd'",
  alias: "import { Table as Grid, Button } from 'antd'",
  namespace: "import * as Antd from 'antd'",
  defaultNamespace: "import Antd from 'antd'",
  deep: "import Grid from 'antd/es/table'",
  deepNested: "import Grid from 'antd/lib/table/Table'",
  reexport: "export { Table as Grid } from 'antd'",
  star: "export * from 'antd'",
  namespaceExport: "export * as Antd from 'antd'",
  deepExport: "export { default as Grid } from 'antd/es/table'",
  dynamic: "const module = import('antd')",
  require: "const { Table } = require('antd')",
  importEquals: "import Antd = require('antd')",
})) {
  test(`rejects ${name}`, () => assert.equal(scanTableImports(file, source).length, 1))
}

for (const [name, source] of Object.entries({
  types: "import type { TableProps } from 'antd'",
  inlineType: "import { type Table, Button } from 'antd'",
  deepType: "import type { ColumnsType } from 'antd/es/table'",
  deepInlineType: "import { type ColumnsType } from 'antd/es/table'",
  typeExport: "export type { TableProps } from 'antd'",
  inlineTypeExport: "export { type ColumnsType } from 'antd/es/table'",
  typeQuery: "type Props = import('antd').TableProps",
  controls: "import { Button, Form } from 'antd'",
  shared: "import { AdminTable } from '@/components/admin-table'",
  comments: "// import { Table } from 'antd'\nconst text = `Table`",
})) {
  test(`allows ${name}`, () => assert.deepEqual(scanTableImports(file, source), []))
}

test('limits the implementation exemption to one exact path', () => {
  const source = "import { Table } from 'antd'"
  assert.deepEqual(scanTableImports('src/components/admin-table.tsx', source), [])
  assert.equal(scanTableImports('src/components/another-table.tsx', source).length, 1)
  assert.deepEqual(scanTableImports('src/features/example/page.test.tsx', source), [])
})

test('baseline permits old debt but not new files or extra occurrences', () => {
  const old = scanTableImports(file, "import { Table } from 'antd'")
  assert.deepEqual(newViolations(old, old), [])
  assert.equal(newViolations([...old, ...old], old).length, 1)
  const moved = scanTableImports('src/features/new/page.tsx', "import { Table } from 'antd'")
  assert.equal(newViolations(moved, old).length, 1)
  assert.deepEqual(newViolations([], old), [])
})
