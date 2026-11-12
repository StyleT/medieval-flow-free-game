// Dev-only: rebuilds public/art from art/*.px.js with the pxl skill. PNGs are committed, so CI never runs this.
import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, rmSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const pxl = process.env.PXL ?? join(homedir(), '.claude/skills/pxl-pixel-art/bin/pxl.js')
if (!existsSync(pxl)) {
  console.error(`pxl not found at ${pxl}. Install the pxl-pixel-art skill or set PXL=/path/to/pxl.js`)
  process.exit(1)
}
const sources = readdirSync('art').filter((f) => f.endsWith('.px.js') && f !== 'palette.px.js')
for (const file of sources) {
  const run = spawnSync('node', [pxl, 'build', join('art', file), '--out', 'public/art', '--no-preview'], { stdio: 'inherit' })
  if (run.status !== 0) process.exit(run.status ?? 1)
}

// Keep only the PNGs the app loads (pxl also writes GIF/JSON by-products).
for (const dir of ['sprites', 'scenes', 'anims']) {
  const path = join('public/art', dir)
  for (const f of readdirSync(path)) if (!f.endsWith('.png')) rmSync(join(path, f), { recursive: true })
}
