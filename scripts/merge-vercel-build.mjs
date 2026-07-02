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

const publicDir = path.join(root, 'public')
const backendPublicDir = path.join(root, 'backend', 'public')
const vercelOutputStatic = '/vercel/output/static'
const localVercelOutputStatic = path.join(root, '.vercel', 'output', 'static')

fs.rmSync(out, { recursive: true, force: true })
copyDir(frontendBuild, out)
copyDir(adminBuild, path.join(out, 'admin'))

fs.rmSync(backendPublicDir, { recursive: true, force: true })
copyDir(out, backendPublicDir)

if (fs.existsSync('/vercel/output')) {
  fs.rmSync(vercelOutputStatic, { recursive: true, force: true })
  copyDir(out, vercelOutputStatic)
  console.log('Merged frontend + admin into dist/, backend/public/, and /vercel/output/static/')
} else if (fs.existsSync(path.join(root, '.vercel', 'output'))) {
  fs.rmSync(localVercelOutputStatic, { recursive: true, force: true })
  copyDir(out, localVercelOutputStatic)
  fs.rmSync(publicDir, { recursive: true, force: true })
  copyDir(out, publicDir)
  console.log('Merged frontend + admin into dist/, public/, backend/public/, and .vercel/output/static/')
} else {
  fs.rmSync(publicDir, { recursive: true, force: true })
  copyDir(out, publicDir)
  console.log('Merged frontend + admin into dist/, public/, and backend/public/')
}
