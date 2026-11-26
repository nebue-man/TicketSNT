// Fast QR decoding from a live <video>.
//
// Uses the browser's native BarcodeDetector where it supports QR (Android Chrome),
// otherwise falls back to ZXing run on a small, centre-cropped greyscale frame —
// decoding a ~480px crop is many times cheaper than a full 1080p frame.

export interface QrDecoder {
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

async function createNativeDecoder(): Promise<QrDecoder | null> {
  const Ctor = (globalThis as { BarcodeDetector?: NativeBarcodeDetectorCtor }).BarcodeDetector
  if (!Ctor) return null
  try {
    const formats = await Ctor.getSupportedFormats()
    if (!formats.includes('qr_code')) return null
    const detector = new Ctor({ formats: ['qr_code'] })
    return {
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

/** RGBA pixels → one greyscale byte per pixel (ITU-R BT.601 weights). */
export function rgbaToLuminance(rgba: Uint8ClampedArray, pixelCount: number): Uint8ClampedArray {
  const lum = new Uint8ClampedArray(pixelCount)
  for (let i = 0, p = 0; i < pixelCount; i++, p += 4) {
    lum[i] = (rgba[p] * 77 + rgba[p + 1] * 150 + rgba[p + 2] * 29) >> 8
  }
  return lum
}

type Zxing = typeof import('@zxing/library')

/** Builds a decoder for square greyscale frames. Returns null when no QR is found. */
export function createLuminanceDecoder(zxing: Zxing) {
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

async function createZxingDecoder(): Promise<QrDecoder> {
  const decodeLuminance = createLuminanceDecoder(await import('@zxing/library'))
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!

  return {
    intervalMs: 80,
    async decode(video) {
      const vw = video.videoWidth
      const vh = video.videoHeight
      if (!vw || !vh) return null

      const side = Math.floor(Math.min(vw, vh) * CROP_FRACTION)
      const size = Math.min(side, CROP_SIZE)
      if (canvas.width !== size) { canvas.width = size; canvas.height = size }
      ctx.drawImage(video, (vw - side) / 2, (vh - side) / 2, side, side, 0, 0, size, size)

      const { data } = ctx.getImageData(0, 0, size, size)
      return decodeLuminance(rgbaToLuminance(data, size * size), size)
    },
  }
}

export async function createQrDecoder(): Promise<QrDecoder> {
  return (await createNativeDecoder()) ?? createZxingDecoder()
}
