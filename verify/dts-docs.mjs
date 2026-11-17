// Every declaration the package ships carries a doc comment: each exported
// declaration in dist-lib/**/*.d.ts, and each member of an exported interface.

import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const PKG_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DIST = join(PKG_ROOT, 'dist-lib')

const files = readdirSync(DIST, { recursive: true }).filter(f => f.endsWith('.d.ts')).map(f => join(DIST, f))
const missing = []
for (const file of files) {
  const text = readFileSync(file, 'utf8')
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true)
  const documented = node => (ts.getLeadingCommentRanges(text, node.getFullStart()) ?? []).some(c => text.startsWith('/**', c.pos))
  const report = (node, name) => { if (!documented(node)) missing.push(`${relative(PKG_ROOT, file)}: ${name}`) }
  for (const stmt of source.statements) {
    if (!ts.getModifiers(stmt)?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) continue
    if (ts.isVariableStatement(stmt)) { report(stmt, stmt.declarationList.declarations.map(d => d.name.getText()).join(', ')); continue }
    if (!stmt.name) continue
    report(stmt, stmt.name.text)
    if (ts.isInterfaceDeclaration(stmt)) for (const m of stmt.members) report(m, `${stmt.name.text}.${m.name?.getText() ?? m.getText()}`)
  }
}
for (const line of missing) console.error(`no doc comment: ${line}`)
if (missing.length) process.exit(1)
console.log(`shipped docs: every exported declaration in ${files.length} declaration file(s) carries a doc comment`)
