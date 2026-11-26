// Fast QR decoding from a live <video>. Picks the fastest decoder the device has:
//
//   1. Native BarcodeDetector (Android Chrome) — reads the full frame.
//   2. ZXing-C++ compiled to WebAssembly (iPhone and everything else) — reads a
//      small centre crop. The .wasm is served from our own domain (/zxing/…),
//      copied there from node_modules by scripts/copy-zxing-wasm.mjs.
//   3. ZXing JavaScript — last resort if the .wasm can't be loaded.
//
// Decoding a ~480px crop is many times cheaper than a full 1080p frame.

import type { ReaderOptions } from 'zxing-wasm/reader'

export interface QrDecoder {
  /** Which decoder is in use — shown nowhere, handy when debugging on a phone. */
  kind: 'native' | 'wasm' | 'js'
  /** Returns the QR text visible in the frame, or null if none was found. */
  decode(video: HTMLVideoElement): Promise<string | null>
  /** Milliseconds to wait between decode attempts. */
  intervalMs: number
}

interface NativeBarcodeDetector {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>
}
interface NativeBarcodeDetectorCtor {
  new (opts: { formats: string[] }): NativeBarcodeDetector
  getSupportedFormats(): Promise<string[]>
}

const CROP_FRACTION = 0.7 // centre square, as a fraction of the shorter video side
const CROP_SIZE = 480     // px the crop is scaled down to before decoding

export const ZXING_WASM_PATH = '/zxing/zxing_reader.wasm'
const WASM_LOAD_TIMEOUT_MS = 8000

/** Tuned for one ticket QR per frame, as fast as possible. */
export const WASM_READER_OPTIONS: ReaderOptions = {
  formats: ['QRCode'],
  maxNumberOfSymbols: 1,
  tryHarder: true,
  tryRotate: false,    // QR finder patterns already work at any angle
  tryInvert: false,    // tickets are dark-on-light
  tryDownscale: false, // the crop is already small
}

/** Draws the centre square of the video into a small canvas and returns its pixels. */
function createFrameCropper() {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  return (video: HTMLVideoElement): ImageData | null => {
    const vw = video.videoWidth
    const vh = video.videoHeight
    if (!vw || !vh) return null
    const side = Math.floor(Math.min(vw, vh) * CROP_FRACTION)
    const size = Math.min(side, CROP_SIZE)
    if (canvas.width !== size) { canvas.width = size; canvas.height = size }
    ctx.drawImage(video, (vw - side) / 2, (vh - side) / 2, side, side, 0, 0, size, size)
    return ctx.getImageData(0, 0, size, size)
  }
}

// ── 1. Native ────────────────────────────────────────────────────────────────

async function createNativeDecoder(): Promise<QrDecoder | null> {
  const Ctor = (globalThis as { BarcodeDetector?: NativeBarcodeDetectorCtor }).BarcodeDetector
  if (!Ctor) return null
  try {
    const formats = await Ctor.getSupportedFormats()
    if (!formats.includes('qr_code')) return null
    const detector = new Ctor({ formats: ['qr_code'] })
    return {
      kind: 'native',
      intervalMs: 50,
      async decode(video) {
        const codes = await detector.detect(video)
        return codes[0]?.rawValue ?? null
      },
    }
  } catch {
    return null
  }
}

// ── 2. WebAssembly ───────────────────────────────────────────────────────────

type ZxingWasm = typeof import('zxing-wasm/reader')

/** Decodes one RGBA frame with an already-prepared zxing-wasm module. */
export function createWasmImageDecoder(zxing: Pick<ZxingWasm, 'readBarcodes'>) {
  return async (image: ImageData): Promise<string | null> => {
    const [result] = await zxing.readBarcodes(image, WASM_READER_OPTIONS)
    return result?.isValid ? result.text : null
  }
}

async function createWasmDecoder(): Promise<QrDecoder | null> {
  try {
    const zxing = await import('zxing-wasm/reader')
    // Fetch + compile the .wasm now, so the first scan doesn't wait for it.
    // On a very slow connection, give up and use the JS decoder instead.
    const ready = zxing.prepareZXingModule({
      overrides: {
        locateFile: (path: string, prefix: string) =>
          path.endsWith('.wasm') ? `${ZXING_WASM_PATH}?v=${zxing.ZXING_WASM_VERSION}` : prefix + path,
      },
      fireImmediately: true,
    })
    let timer: ReturnType<typeof setTimeout> | undefined
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('zxing-wasm load timed out')), WASM_LOAD_TIMEOUT_MS)
    })
    try {
      await Promise.race([ready, timeout])
    } finally {
      clearTimeout(timer)
    }
    const decodeImage = createWasmImageDecoder(zxing)
    const crop = createFrameCropper()
    return {
      kind: 'wasm',
      intervalMs: 60,
      async decode(video) {
        const image = crop(video)
        return image ? decodeImage(image) : null
      },
    }
  } catch {
    return null
  }
}

// ── 3. JavaScript fallback ───────────────────────────────────────────────────

/** RGBA pixels → one greyscale byte per pixel (ITU-R BT.601 weights). */
export function rgbaToLuminance(rgba: Uint8ClampedArray, pixelCount: number): Uint8ClampedArray {
  const lum = new Uint8ClampedArray(pixelCount)
  for (let i = 0, p = 0; i < pixelCount; i++, p += 4) {
    lum[i] = (rgba[p] * 77 + rgba[p + 1] * 150 + rgba[p + 2] * 29) >> 8
  }
  return lum
}

type ZxingJs = typeof import('@zxing/library')

/** Builds a decoder for square greyscale frames. Returns null when no QR is found. */
export function createLuminanceDecoder(zxing: ZxingJs) {
  const { QRCodeReader, BinaryBitmap, HybridBinarizer, RGBLuminanceSource } = zxing
  const reader = new QRCodeReader()
  return (lum: Uint8ClampedArray, size: number): string | null => {
    try {
      const bitmap = new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(lum, size, size)))
      return reader.decode(bitmap).getText()
    } catch {
      return null // no QR in this frame — normal
    } finally {
      reader.reset()
    }
  }
}

async function createJsDecoder(): Promise<QrDecoder> {
  const decodeLuminance = createLuminanceDecoder(await import('@zxing/library'))
  const crop = createFrameCropper()
  return {
    kind: 'js',
    intervalMs: 80,
    async decode(video) {
      const image = crop(video)
      return image ? decodeLuminance(rgbaToLuminance(image.data, image.width * image.height), image.width) : null
    },
  }
}

export async function createQrDecoder(): Promise<QrDecoder> {
  const decoder = (await createNativeDecoder()) ?? (await createWasmDecoder()) ?? (await createJsDecoder())
  console.info(`[gate] QR decoder: ${decoder.kind}`)
  return decoder
}
