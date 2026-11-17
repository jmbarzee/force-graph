// The README names only what the entry exports: a backticked name that some
// file in src/ exports, but src/index.ts does not, is a citation a host cannot import.

import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const PKG_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(PKG_ROOT, 'src')

function exportsOf(file) {
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest)
  const names = []
  for (const stmt of source.statements) {
    if (ts.isExportDeclaration(stmt)) {
      if (stmt.exportClause && ts.isNamedExports(stmt.exportClause)) names.push(...stmt.exportClause.elements.map(e => e.name.text))
    } else if (ts.getModifiers(stmt)?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) {
      if (ts.isVariableStatement(stmt)) names.push(...stmt.declarationList.declarations.map(d => d.name.getText(source)))
      else if (stmt.name) names.push(stmt.name.text)
    }
  }
  return names
}

const entry = new Set(exportsOf(join(SRC, 'index.ts')))
const declared = new Set(readdirSync(SRC, { recursive: true })
  .filter(f => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f))
  .flatMap(f => exportsOf(join(SRC, f))))

const prose = readFileSync(join(PKG_ROOT, 'README.md'), 'utf8').replace(/^```[\s\S]*?^```/gm, '')
const cited = new Set([...prose.matchAll(/`([A-Za-z_$][\w$]*)(?:[.(<][^`]*)?`/g)].map(m => m[1]))
const unexported = [...cited].filter(name => declared.has(name) && !entry.has(name)).sort()

for (const name of unexported) console.error(`README.md names \`${name}\`, which src/index.ts does not export`)
if (unexported.length) process.exit(1)
console.log(`README names: every backticked name src/ exports is exported from src/index.ts`)
