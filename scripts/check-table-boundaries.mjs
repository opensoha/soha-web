#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const implementation = 'src/components/admin-table.tsx'
const productionSource = (path) =>
  /\.(ts|tsx)$/.test(path) && !/\.d\.ts$|\.(test|spec|stories)\./.test(path)

function isTableEntry(value) {
  return /^antd\/(es|lib)\/table(?:\/|$)/.test(value)
}

// This is an import-boundary guard, not a claim of visual or behavioral compliance.
export function scanTableImports(file, source) {
  if (!productionSource(file) || file === implementation) return []
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true)
  const violations = []
  const add = (node, signature) => {
    const location = ast.getLineAndCharacterOfPosition(node.getStart(ast))
    violations.push({ file, line: location.line + 1, signature, fingerprint: `${file}|${signature}` })
  }
  const inspect = (node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteralLike(node.moduleSpecifier)) {
      const specifier = node.moduleSpecifier.text
      const clause = node.importClause
      if (clause && !clause.isTypeOnly) {
        const bindings = clause.namedBindings
        const hasValue =
          clause.name ||
          (bindings &&
            (ts.isNamespaceImport(bindings) || bindings.elements.some((item) => !item.isTypeOnly)))
        if (isTableEntry(specifier) && hasValue) add(node, `table-entry:${specifier}`)
        if (specifier === 'antd') {
          if (clause.name || (bindings && ts.isNamespaceImport(bindings))) {
            add(node, 'antd-namespace')
          } else if (bindings && ts.isNamedImports(bindings)) {
            for (const item of bindings.elements) {
              if (!item.isTypeOnly && (item.propertyName ?? item.name).text === 'Table') {
                add(item, 'antd-Table')
              }
            }
          }
        }
      }
    } else if (
      ts.isExportDeclaration(node) &&
      !node.isTypeOnly &&
      node.moduleSpecifier &&
      ts.isStringLiteralLike(node.moduleSpecifier)
    ) {
      const specifier = node.moduleSpecifier.text
      const clause = node.exportClause
      const hasValue =
        !clause ||
        !ts.isNamedExports(clause) ||
        clause.elements.some((item) => !item.isTypeOnly)
      if (isTableEntry(specifier) && hasValue) add(node, `table-export:${specifier}`)
      if (specifier === 'antd') {
        if (!clause || !ts.isNamedExports(clause)) add(node, 'antd-export-namespace')
        else {
          for (const item of clause.elements) {
            if (!item.isTypeOnly && (item.propertyName ?? item.name).text === 'Table') {
              add(item, 'antd-export-Table')
            }
          }
        }
      }
    } else if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === 'require')) &&
      node.arguments.length >= 1 &&
      ts.isStringLiteralLike(node.arguments[0])
    ) {
      const specifier = node.arguments[0].text
      if (specifier === 'antd' || isTableEntry(specifier)) add(node, `antd-runtime:${specifier}`)
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      !node.isTypeOnly &&
      ts.isExternalModuleReference(node.moduleReference) &&
      node.moduleReference.expression &&
      ts.isStringLiteralLike(node.moduleReference.expression)
    ) {
      const specifier = node.moduleReference.expression.text
      if (specifier === 'antd' || isTableEntry(specifier)) add(node, `antd-equals:${specifier}`)
    }
    ts.forEachChild(node, inspect)
  }
  inspect(ast)
  return violations
}

export function newViolations(current, baseline) {
  const remaining = new Map()
  for (const item of baseline) {
    remaining.set(item.fingerprint, (remaining.get(item.fingerprint) ?? 0) + 1)
  }
  return current.filter((item) => {
    const count = remaining.get(item.fingerprint) ?? 0
    if (!count) return true
    remaining.set(item.fingerprint, count - 1)
    return false
  })
}

function git(args) {
  return execFileSync('git', args, { cwd: projectRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
}

function worktreeSources(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return worktreeSources(path)
    const file = relative(projectRoot, path).split('\\').join('/')
    return entry.isFile() && productionSource(file)
      ? [[file, readFileSync(path, 'utf8')]]
      : []
  })
}

function baselineSources(ref) {
  // Resolve before use: never accept a missing baseline or compare against HEAD itself.
  const revision = git(['rev-parse', '--verify', `${ref}^{commit}`]).trim()
  const base = git(['merge-base', 'HEAD', revision]).trim()
  if (base === git(['rev-parse', 'HEAD']).trim()) {
    throw new Error('The table boundary baseline must precede HEAD, not be HEAD itself.')
  }
  return git(['ls-tree', '-rz', '--name-only', base, '--', 'src'])
    .split('\0')
    .filter(productionSource)
    .map((file) => [file, git(['show', `${base}:${file}`])])
}

function main() {
  const args = process.argv.slice(2)
  if (args.length > 1 || (args.length === 1 && args[0] !== '--enforce')) {
    throw new Error('Usage: node scripts/check-table-boundaries.mjs [--enforce]')
  }
  const scan = (sources) => sources.flatMap(([file, source]) => scanTableImports(file, source))
  const current = scan(worktreeSources(join(projectRoot, 'src')))
  let added = current
  if (args[0] === '--enforce') {
    const ref = process.env.TABLE_BOUNDARY_BASE_REF
    if (!ref || /^0+$/.test(ref)) throw new Error('Set TABLE_BOUNDARY_BASE_REF to the reviewed base revision.')
    added = newViolations(current, scan(baselineSources(ref)))
  }
  console.log(`Table imports: ${current.length} total, ${added.length} ${args[0] ? 'new' : 'reported'}.`)
  for (const item of added) {
    console.error(`${item.file}:${item.line} [${item.signature}] Use AdminTable; import other Antd controls by name.`)
  }
  if (args[0] && added.length) process.exitCode = 1
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main()
  } catch (error) {
    console.error(`Table boundary configuration error: ${error.message}`)
    process.exitCode = 2
  }
}
