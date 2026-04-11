// Genera pwa-192x192.png y pwa-512x512.png sin dependencias externas
// Solo usa zlib (builtin de Node.js)
import { deflateSync } from 'zlib'
import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ── CRC32 ──────────────────────────────────────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[i] = c
  }
  return t
})()

function crc32(buf) {
  let c = 0xffffffff
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function pngChunk(type, data) {
  const lenBuf = Buffer.alloc(4)
  lenBuf.writeUInt32BE(data.length)
  const typeBuf = Buffer.from(type, 'ascii')
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])))
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf])
}

// ── Dibujo ─────────────────────────────────────────────────────────────────
function lerp(a, b, t) { return a + (b - a) * t }

function generateIcon(size) {
  // Paleta
  const BG   = [10, 14, 26]      // #0a0e1a
  const BALL  = [245, 245, 245]  // blanco roto
  const PATCH = [20, 20, 24]     // casi negro
  const ACCENT = [204, 0, 0]     // #cc0000 (contorno)

  const cx = size / 2, cy = size / 2
  const R  = size * 0.38          // radio del balón
  const rPatch = R * 0.26         // radio de cada mancha

  // Centros de manchas: centro + 5 alrededor
  const patchAngle = -Math.PI / 2  // empieza arriba
  const patchDist  = R * 0.54
  const patches = [
    [cx, cy],
    ...Array.from({ length: 5 }, (_, i) => {
      const a = patchAngle + (i * 2 * Math.PI) / 5
      return [cx + Math.cos(a) * patchDist, cy + Math.sin(a) * patchDist]
    }),
  ]

  // Buffer de píxeles RGBA (4 canales para claridad, luego convertimos a RGB)
  const img = new Uint8Array(size * size * 3)

  // Rellena fondo
  for (let i = 0; i < size * size; i++) {
    img[i * 3]     = BG[0]
    img[i * 3 + 1] = BG[1]
    img[i * 3 + 2] = BG[2]
  }

  // Rellena balón con anti-aliasing suave
  const AA = 1.5
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - cx, dy = y - cy
      const d = Math.sqrt(dx * dx + dy * dy)

      // Borde rojo exterior (contorno)
      const tOut = Math.min(1, Math.max(0, (d - (R + AA)) / AA))
      const tBall = Math.min(1, Math.max(0, (d - (R - AA)) / AA))

      if (d < R + AA * 2) {
        const idx = (y * size + x) * 3

        if (d < R - AA) {
          // Interior del balón: blanco
          img[idx] = BALL[0]; img[idx + 1] = BALL[1]; img[idx + 2] = BALL[2]
        } else if (d < R + AA * 2) {
          // Borde suavizado rojo→fondo
          const t = (d - (R - AA)) / (AA * 3)
          const blend = Math.min(1, Math.max(0, t))
          // Mezcla BALL → ACCENT → BG
          const t2 = Math.min(1, blend * 2)
          const t3 = Math.max(0, blend * 2 - 1)
          img[idx]     = Math.round(lerp(lerp(BALL[0], ACCENT[0], t2), BG[0], t3))
          img[idx + 1] = Math.round(lerp(lerp(BALL[1], ACCENT[1], t2), BG[1], t3))
          img[idx + 2] = Math.round(lerp(lerp(BALL[2], ACCENT[2], t2), BG[2], t3))
        }
      }
    }
  }

  // Dibuja manchas negras sobre el balón
  for (const [px, py] of patches) {
    const distFromCenter = Math.sqrt((px - cx) ** 2 + (py - cy) ** 2)
    if (distFromCenter > R * 0.82) continue

    for (let y = Math.max(0, Math.floor(py - rPatch - AA)); y <= Math.min(size - 1, Math.ceil(py + rPatch + AA)); y++) {
      for (let x = Math.max(0, Math.floor(px - rPatch - AA)); x <= Math.min(size - 1, Math.ceil(px + rPatch + AA)); x++) {
        const dx = x - cx, dy = y - cy
        const distBall = Math.sqrt(dx * dx + dy * dy)
        if (distBall > R - 1) continue  // fuera del balón

        const dpx = x - px, dpy = y - py
        const dp = Math.sqrt(dpx * dpx + dpy * dpy)
        if (dp < rPatch + AA) {
          const idx = (y * size + x) * 3
          const t = Math.min(1, Math.max(0, (rPatch - dp) / AA))
          img[idx]     = Math.round(lerp(img[idx],     PATCH[0], t))
          img[idx + 1] = Math.round(lerp(img[idx + 1], PATCH[1], t))
          img[idx + 2] = Math.round(lerp(img[idx + 2], PATCH[2], t))
        }
      }
    }
  }

  // ── Construye PNG ─────────────────────────────────────────────────────────
  const PNG_SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8; ihdr[9] = 2  // 8-bit RGB

  // Filas con byte de filtro 0 (None) al inicio de cada fila
  const raw = Buffer.alloc(size * (1 + size * 3))
  for (let y = 0; y < size; y++) {
    raw[y * (1 + size * 3)] = 0  // filter None
    img.copy
      ? img.copy(raw, y * (1 + size * 3) + 1, y * size * 3, (y + 1) * size * 3)
      : raw.set(img.subarray(y * size * 3, (y + 1) * size * 3), y * (1 + size * 3) + 1)
  }

  const idat = deflateSync(raw, { level: 9 })

  return Buffer.concat([
    PNG_SIG,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

// ── Main ───────────────────────────────────────────────────────────────────
const publicDir = join(__dirname, '..', 'public')
mkdirSync(publicDir, { recursive: true })

for (const size of [192, 512]) {
  const buf = generateIcon(size)
  const out = join(publicDir, `pwa-${size}x${size}.png`)
  writeFileSync(out, buf)
  console.log(`✓ pwa-${size}x${size}.png  (${(buf.length / 1024).toFixed(1)} KB)`)
}
