/* eslint-disable import/no-unresolved */
import { existsSync, readdirSync, readFileSync } from 'fs'
import path from 'path'

import activate from '../workers/activate.js?raw'
import cacheFirst from '../workers/cacheFirst.js?raw'
import dynamicFetch from '../workers/dynamicFetch.js?raw'
import dynamicInstall from '../workers/dynamicInstall.js?raw'
import load from '../workers/load.js?raw'
import match from '../workers/match.js?raw'
import networkDataFirst from '../workers/networkDataFirst.js?raw'
import networkFirst from '../workers/networkFirst.js?raw'
import staleWhileRevalidate from '../workers/staleWhileRevalidate.js?raw'
import staticFetch from '../workers/staticFetch.js?raw'
import staticHelpers from '../workers/staticHelpers.js?raw'
import staticInstall from '../workers/staticInstall.js?raw'
import environment from './environment'
import files from './files'
import project from './project'
import settings from './settings'

const worker = {}

worker.enabled = true
worker.fetching = false
worker.preload = []
worker.staleWhileRevalidate = []
worker.cacheFirst = []
worker.headers = {}
worker.api = process.env.NULLSTACK_WORKER_API ?? ''
worker.cdn = process.env.NULLSTACK_WORKER_CDN ?? ''
worker.protocol = process.env.NULLSTACK_WORKER_PROTOCOL ?? (environment.development ? 'http' : 'https')

const emptyQueue = Object.freeze([])

const queuesProxyHandler = {
  get() {
    return emptyQueue
  },
}

worker.queues = new Proxy({}, queuesProxyHandler)

function replacer(key, value) {
  if (value instanceof RegExp) {
    return JSON.stringify({ flags: value.flags, source: value.source })
  }
  return value
}

export function generateServiceWorker(cwd) {
  if (files['service-worker.js']) return files['service-worker.js']
  const sources = []
  const context = { environment, project, settings, worker }
  let original = ''
  const file = path.join(cwd, 'public', 'service-worker.js')
  if (existsSync(file)) {
    original = readFileSync(file, 'utf-8')
  }
  const bundleFolder = path.join(cwd, environment.production ? '.production' : '.development')
  const scripts = readdirSync(bundleFolder)
    .filter((filename) => filename.includes('.client.') && !filename.endsWith('.map'))
    .map((filename) => `'/${filename}'`)
  sources.push(`self.context = ${JSON.stringify(context, replacer, 2)};`)
  sources.push(load)
  sources.push(match)
  if (environment.mode === 'ssg') {
    sources.push(staticHelpers)
    sources.push(cacheFirst)
    sources.push(staleWhileRevalidate)
    sources.push(networkFirst)
    sources.push(networkDataFirst)
  } else {
    sources.push(cacheFirst)
    sources.push(staleWhileRevalidate)
    sources.push(networkFirst)
  }
  if (original.indexOf('install') === -1) {
    sources.push(environment.mode === 'ssg' ? staticInstall : dynamicInstall)
  }
  if (original.indexOf('activate') === -1) {
    sources.push(activate)
  }
  if (original.indexOf('fetch') === -1) {
    sources.push(environment.mode === 'ssg' ? staticFetch : dynamicFetch)
  }
  if (original) {
    sources.push(original)
  }
  files['service-worker.js'] = sources.join(`\n\n`).replace(`globalThis.__NULLSTACK_BUNDLE`, scripts.join(', \n'))
  return files['service-worker.js']
}

export default worker
