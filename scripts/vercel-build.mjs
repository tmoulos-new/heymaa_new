import { spawnSync } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

function run(label, command, args, extraEnv = {}) {
  console.log(`\n=== ${label} ===\n> ${command} ${args.join(' ')}\n`)
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, ...extraEnv },
  })
  if (result.status !== 0) {
    console.error(`\n=== FAILED: ${label} (exit ${result.status}) ===`)
    process.exit(result.status || 1)
  }
}

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const node = process.execPath
const installArgs = ['install', '--include=dev', '--no-audit', '--no-fund']

run('frontend npm install', npm, [...installArgs, '--prefix', 'frontend'])
run('admin npm install', npm, [...installArgs, '--prefix', 'admin'])
run('frontend production build', npm, ['run', 'build', '--prefix', 'frontend'], {
  CI: 'true',
  GENERATE_SOURCEMAP: 'false',
  // Vercel treats ESLint warnings as errors; keep deploys unblocked.
  DISABLE_ESLINT_PLUGIN: 'true',
})
run('admin production build', npm, ['run', 'build', '--prefix', 'admin'])
run('merge frontend + admin output', node, ['scripts/merge-vercel-build.mjs'])

console.log('\n=== Vercel build finished ===')
