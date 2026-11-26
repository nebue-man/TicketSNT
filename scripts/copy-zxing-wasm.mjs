// Copies the ZXing WebAssembly reader into public/ so the gate scanner loads it
// from our own domain (not a third-party CDN). Runs on every npm install, so the
// served file always matches the installed zxing-wasm version.
import { copyFileSync, mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const src = require.resolve('zxing-wasm/reader/zxing_reader.wasm')
const destDir = join(root, 'public', 'zxing')

mkdirSync(destDir, { recursive: true })
copyFileSync(src, join(destDir, 'zxing_reader.wasm'))
console.log('[copy-zxing-wasm] public/zxing/zxing_reader.wasm updated')
