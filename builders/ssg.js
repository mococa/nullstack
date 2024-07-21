module.exports = async function ssg({ output, cache, environment, cwd }) {
  const folder = output || 'ssg'
  process.env.NULLSTACK_ENVIRONMENT_MODE = 'ssg'

  const dir = cwd
  const application = require(`${dir}/.${environment}/server`).default
  const projectName = application.project.name || 'The Nullstack application'
  const { resolve } = require('path')
  const { existsSync, mkdirSync, writeFileSync, copySync, removeSync } = require('fs-extra')

  function path(file = '') {
    const target = file.startsWith('/') ? file.slice(1) : file
    return resolve(`${dir}/${folder}`, target).split('?')[0]
  }

  const links = {}
  const pages = {}

  async function copyRoute(url = '/') {
    links[url] = true
    if (url.indexOf('.') > -1) {
      return
    }
    const content = await application.server.prerender(url)
    const target = path(url)

    console.info(` ⚙️  ${url}`)
    if (!existsSync(target)) {
      mkdirSync(target, { recursive: true })
    }
    writeFileSync(`${target}/index.html`, content)
    if (url !== '/') {
      writeFileSync(`${target}.html`, content)
    }

    const stateLookup = '<meta name="nullstack" content="'
    const state = content
      .split('\n')
      .find((line) => line.indexOf(stateLookup) > -1)
      .split(stateLookup)[1]
      .slice(0, -2)
    const { instances, page } = JSON.parse(decodeURIComponent(state))

    if (url !== `/nullstack/${application.environment.key}/offline` && url !== '/404') {
      pages[url] = page
    }

    const json = JSON.stringify({ instances, page })
    writeFileSync(`${target}/index.json`, json)

    const pattern = /href="(.*?)"/g
    let match
    while ((match = pattern.exec(content))) {
      const link = match[1].split('#')[0]
      if (link.startsWith('/')) {
        if (links[link] === undefined) {
          links[link] = false
        }
      }
    }

    for (const link in links) {
      if (!links[link]) {
        await copyRoute(link)
      }
    }
  }

  async function copyBundle(url) {
    console.info(` ⚙️  ${url}`)
    const content = await application.server.prerender(url)
    const target = path(url)
    writeFileSync(target, content)
  }

  async function createSitemap() {
    console.info(' ⚙️  /sitemap.xml')
    const timestamp = new Date().toJSON().substring(0, 10)
    const urls = Object.keys(pages).map((p) => {
      const page = pages[p]
      const canonical = `https://${application.project.domain}${p}`
      return `<url><loc>${canonical}</loc><lastmod>${timestamp}</lastmod>${page.changes ? `<changefreq>${page.changes}</changefreq>` : ''
        }${page.priority ? `<priority>${page.priority.toFixed(1)}</priority>` : ''}</url>`
    })
    const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join(
      '',
    )}</urlset>`
    writeFileSync(`${path()}/sitemap.xml`, xml)
  }

  function filter(src, dest) {
    return dest.endsWith(folder) || (src.includes('client') && !src.includes('.txt'))
  }

  console.info()
  if (existsSync(path())) {
    removeSync(path())
  }
  mkdirSync(path())
  console.info(` ⚙️  /public/`)
  copySync(path(`../public`), path())
  console.info(` ⚙️  /.${environment}/`)
  copySync(path(`../.${environment}`), path(), { filter })
  await copyRoute()
  await copyRoute(`/nullstack/${application.environment.key}/offline`)
  await copyRoute(`/404`)
  await copyBundle(`/manifest.webmanifest`)
  await copyBundle(`/service-worker.js`)
  await copyBundle('/robots.txt')
  await createSitemap()
  console.info()

  console.info('\x1b[36m%s\x1b[0m', ` 🚀 ${projectName} is ready at ${folder}\n`)

  if (cache) {
    console.info('Storing cache...')
  } else if (environment === 'production') {
    process.exit()
  }
}
