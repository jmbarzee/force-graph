// Every colour the library draws is a token: no hex, rgb() or hsl() literal in
// its CSS or in src/components/ outside tokens.css. A test's colours are data.

import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'src')
const LITERAL = /(?<![\w&])#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})\b|\b(?:rgba?|hsla?)\(/i

const files = readdirSync(SRC, { recursive: true })
  .filter(f => f !== 'styles/tokens.css' && !/\.test\.tsx?$/.test(f))
  .filter(f => f.endsWith('.css') || (f.startsWith('components/') && /\.tsx?$/.test(f)))
const found = files.flatMap(f => readFileSync(join(SRC, f), 'utf8').split('\n')
  .flatMap((line, i) => LITERAL.test(line) ? [`src/${f}:${i + 1}: ${line.trim()}`] : []))
for (const line of found) console.error(`colour literal outside the tokens: ${line}`)
if (found.length) process.exit(1)
console.log(`colour literals: none in ${files.length} file(s) outside tokens.css`)
