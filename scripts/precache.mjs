// After `nuxt generate`: the list of every file of the build, which the service worker (public/sw.js)
// downloads when it is installed, so the whole POS opens without internet
import { readdir, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const dir = '.output/public'
const files = []
for (const path of await readdir(dir, { recursive: true })) {
  if (!['sw.js', 'precache.json'].includes(path) && !path.endsWith('.html') && (await stat(join(dir, path))).isFile()) {
    files.push(path.split('\\').join('/'))
  }
}
await writeFile(join(dir, 'precache.json'), JSON.stringify(files))
console.log(`precache.json: ${files.length} files`)
