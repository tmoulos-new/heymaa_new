import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PNG } from 'pngjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const publicDir = path.join(__dirname, '..', 'public')
const assetsDir = path.join(__dirname, '..', 'src', 'assets')
const sourcePath = path.join(publicDir, 'logo512.png')
const outputPath = path.join(assetsDir, 'logo-circle.png')

const source = PNG.sync.read(fs.readFileSync(sourcePath))
const { width, height, data } = source

const isLogoPixel = (r, g, b) => {
  // Ignore the black square padding around the circular brand mark.
  return r + g + b > 40
}

let sumX = 0
let sumY = 0
let count = 0

for (let y = 0; y < height; y += 1) {
  for (let x = 0; x < width; x += 1) {
    const idx = (width * y + x) << 2
    const r = data[idx]
    const g = data[idx + 1]
    const b = data[idx + 2]

    if (isLogoPixel(r, g, b)) {
      sumX += x
      sumY += y
      count += 1
    }
  }
}

if (!count) {
  throw new Error('Could not detect logo pixels in source image.')
}

const centerX = sumX / count
const centerY = sumY / count

let radius = 0
for (let y = 0; y < height; y += 1) {
  for (let x = 0; x < width; x += 1) {
    const idx = (width * y + x) << 2
    const r = data[idx]
    const g = data[idx + 1]
    const b = data[idx + 2]

    if (isLogoPixel(r, g, b)) {
      const dx = x - centerX
      const dy = y - centerY
      radius = Math.max(radius, Math.hypot(dx, dy))
    }
  }
}

const size = Math.ceil(radius * 2)
const output = new PNG({ width: size, height: size })

for (let y = 0; y < size; y += 1) {
  for (let x = 0; x < size; x += 1) {
    const outIdx = (size * y + x) << 2
    const dx = x - radius
    const dy = y - radius
    const dist = Math.hypot(dx, dy)

    if (dist > radius) {
      output.data[outIdx] = 0
      output.data[outIdx + 1] = 0
      output.data[outIdx + 2] = 0
      output.data[outIdx + 3] = 0
      continue
    }

    const srcX = Math.round(centerX + dx)
    const srcY = Math.round(centerY + dy)

    if (srcX < 0 || srcY < 0 || srcX >= width || srcY >= height) {
      output.data[outIdx] = 0
      output.data[outIdx + 1] = 0
      output.data[outIdx + 2] = 0
      output.data[outIdx + 3] = 0
      continue
    }

    const srcIdx = (width * srcY + srcX) << 2
    output.data[outIdx] = data[srcIdx]
    output.data[outIdx + 1] = data[srcIdx + 1]
    output.data[outIdx + 2] = data[srcIdx + 2]
    output.data[outIdx + 3] = 255
  }
}

fs.mkdirSync(assetsDir, { recursive: true })
fs.writeFileSync(outputPath, PNG.sync.write(output))
console.log(`Wrote ${outputPath} (${size}x${size})`)
