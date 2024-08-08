const path = require('path')

const queue = {}

export default function lazy(hash, importer) {
  queue[hash] = importer
}

export async function load(hash, cwd) {
  const fileHash = module.hot ? hash.split('___')[0] : hash.slice(0, 8)
  const file = path.resolve(cwd || '', fileHash)
  if (!queue[file]) return
  const importer = queue[file]
  await importer()
  delete queue[file]
}