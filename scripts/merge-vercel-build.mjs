import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const out = path.join(root, 'dist')
const frontendBuild = path.join(root, 'frontend', 'build')
const adminBuild = path.join(root, 'admin', 'dist')

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true })
  for (const ent of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, ent.name)
    const to = path.join(dest, ent.name)
    if (ent.isDirectory()) copyDir(from, to)
    else fs.copyFileSync(from, to)
  }
}

if (!fs.existsSync(frontendBuild)) {
  console.error('Missing frontend/build — run npm run build in frontend first')
  process.exit(1)
}
if (!fs.existsSync(adminBuild)) {
  console.error('Missing admin/dist — run npm run build in admin first')
  process.exit(1)
}

fs.rmSync(out, { recursive: true, force: true })
copyDir(frontendBuild, out)
copyDir(adminBuild, path.join(out, 'admin'))
console.log('Merged frontend + admin into dist/')
