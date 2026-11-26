import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import * as zxing from '@zxing/library'
import * as zxingWasm from 'zxing-wasm/reader'
import { rgbaToLuminance, createLuminanceDecoder, createWasmImageDecoder, ZXING_WASM_PATH } from './qr-decoder'

const require = createRequire(import.meta.url)
const packageWasmPath = require.resolve('zxing-wasm/reader/zxing_reader.wasm')

const SIZE = 480

/** A SIZE×SIZE RGBA frame: grey background with a QR of `text` drawn in the middle. */
function frameWithQr(text: string, qrPx = 300): Uint8ClampedArray {
  const matrix = new zxing.QRCodeWriter().encode(text, zxing.BarcodeFormat.QR_CODE, qrPx, qrPx, new Map())
  const rgba = new Uint8ClampedArray(SIZE * SIZE * 4).fill(200)
  const off = Math.floor((SIZE - qrPx) / 2)
  for (let y = 0; y < qrPx; y++) {
    for (let x = 0; x < qrPx; x++) {
      const v = matrix.get(x, y) ? 20 : 245
      const p = ((y + off) * SIZE + x + off) * 4
      rgba[p] = rgba[p + 1] = rgba[p + 2] = v
    }
  }
  return rgba
}

describe('rgbaToLuminance', () => {
  it('maps black, white and pure colours to expected grey levels', () => {
    const rgba = new Uint8ClampedArray([0, 0, 0, 255, 255, 255, 255, 255, 255, 0, 0, 255, 0, 255, 0, 255])
    const lum = rgbaToLuminance(rgba, 4)
    expect(Array.from(lum)).toEqual([0, 255, 76, 149])
  })
})

describe('createLuminanceDecoder', () => {
  const decode = createLuminanceDecoder(zxing)

  it('decodes a Reservation ID QR from a cropped frame', () => {
    const lum = rgbaToLuminance(frameWithQr('RES-AB12CD'), SIZE * SIZE)
    expect(decode(lum, SIZE)).toBe('RES-AB12CD')
  })

  it('decodes a small QR (ticket held further from the camera)', () => {
    const lum = rgbaToLuminance(frameWithQr('RES-ZZ99XY', 120), SIZE * SIZE)
    expect(decode(lum, SIZE)).toBe('RES-ZZ99XY')
  })

  it('returns null for a frame with no QR', () => {
    expect(decode(new Uint8ClampedArray(SIZE * SIZE).fill(200), SIZE)).toBeNull()
  })

  it('keeps working on consecutive frames (reader is reset between decodes)', () => {
    const a = rgbaToLuminance(frameWithQr('RES-AAAAAA'), SIZE * SIZE)
    const b = rgbaToLuminance(frameWithQr('RES-BBBBBB'), SIZE * SIZE)
    expect(decode(a, SIZE)).toBe('RES-AAAAAA')
    expect(decode(new Uint8ClampedArray(SIZE * SIZE).fill(200), SIZE)).toBeNull()
    expect(decode(b, SIZE)).toBe('RES-BBBBBB')
  })
})

/** Node has no ImageData; zxing-wasm only needs width/height/data. */
function imageData(rgba: Uint8ClampedArray): ImageData {
  return { data: rgba, width: SIZE, height: SIZE, colorSpace: 'srgb' } as ImageData
}

describe('WebAssembly decoder (zxing-wasm)', () => {
  beforeAll(async () => {
    const wasmBinary = readFileSync(packageWasmPath)
    await zxingWasm.prepareZXingModule({
      overrides: { wasmBinary: wasmBinary.buffer.slice(wasmBinary.byteOffset, wasmBinary.byteOffset + wasmBinary.byteLength) },
      fireImmediately: true,
    })
  })

  const decode = createWasmImageDecoder(zxingWasm)

  it('decodes a Reservation ID QR from a cropped frame', async () => {
    expect(await decode(imageData(frameWithQr('RES-AB12CD')))).toBe('RES-AB12CD')
  })

  it('decodes a small QR (ticket held further from the camera)', async () => {
    expect(await decode(imageData(frameWithQr('RES-ZZ99XY', 120)))).toBe('RES-ZZ99XY')
  })

  it('returns null for a frame with no QR', async () => {
    expect(await decode(imageData(new Uint8ClampedArray(SIZE * SIZE * 4).fill(200)))).toBeNull()
  })

  it('decodes consecutive frames', async () => {
    expect(await decode(imageData(frameWithQr('RES-AAAAAA')))).toBe('RES-AAAAAA')
    expect(await decode(imageData(new Uint8ClampedArray(SIZE * SIZE * 4).fill(200)))).toBeNull()
    expect(await decode(imageData(frameWithQr('RES-BBBBBB')))).toBe('RES-BBBBBB')
  })
})

describe('served .wasm file', () => {
  it('public/zxing matches the installed zxing-wasm package (run npm install if this fails)', () => {
    const served = readFileSync(join(process.cwd(), 'public', ZXING_WASM_PATH))
    expect(served.equals(readFileSync(packageWasmPath))).toBe(true)
  })
})
