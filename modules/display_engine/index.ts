/**
 * display_engine
 * --------------------------------------------------
 * Visualization model for the LED matrix / OLED / browser canvas.
 *
 *   Display(x, y) = RGB(x, y)
 *   Bandwidth ∝ N × ColorDepth × FPS
 *
 * Pure data-only. No DOM, no hardware. Renderers (browser canvas,
 * NeoPixel driver, SSD1306 page buffer) consume the produced
 * Frame and Pixel arrays.
 */

export interface Pixel { r: number; g: number; b: number }
export interface Frame { width: number; height: number; pixels: Pixel[] }

export const BLACK: Pixel = { r: 0, g: 0, b: 0 }
export const ACCENT: Pixel = { r: 0, g: 0xe5, b: 0xc8 } // FLLC teal

export function makeFrame(width: number, height: number, fill: Pixel = BLACK): Frame {
  return { width, height, pixels: new Array(width * height).fill(0).map(() => ({ ...fill })) }
}

export function setPixel(f: Frame, x: number, y: number, p: Pixel) {
  if (x < 0 || y < 0 || x >= f.width || y >= f.height) return
  f.pixels[y * f.width + x] = p
}

/** Required SPI/PIO bandwidth (bits/sec) for a given matrix. */
export function bandwidth(opts: { ledCount: number; colorDepthBits: number; fps: number }) {
  return opts.ledCount * opts.colorDepthBits * opts.fps
}

/** Default CyberCard 17×9 status matrix. */
export const STATUS_MATRIX = { width: 17, height: 9, ledCount: 17 * 9 } as const

/** Convert a Frame to the GRB byte order used by WS2812 drivers. */
export function toWS2812Bytes(f: Frame): Uint8Array {
  const out = new Uint8Array(f.pixels.length * 3)
  for (let i = 0; i < f.pixels.length; i++) {
    const p = f.pixels[i]
    out[i * 3 + 0] = p.g
    out[i * 3 + 1] = p.r
    out[i * 3 + 2] = p.b
  }
  return out
}

/** Render a horizontal progress bar — used by the boot scene. */
export function progressBar(f: Frame, ratio: number, color: Pixel = ACCENT) {
  const cols = Math.max(0, Math.min(f.width, Math.round(ratio * f.width)))
  const y = Math.floor(f.height / 2)
  for (let x = 0; x < cols; x++) setPixel(f, x, y, color)
}
