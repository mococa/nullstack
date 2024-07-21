module.exports = async function ssr({ cache, cwd }) {
  const dir = cwd
  const application = require(`${dir}/.production/server`).default
  const projectName = application.project.name || 'The Nullstack application'

  console.info('\x1b[36m%s\x1b[0m', `\n 🚀 ${projectName} is ready for production\n`)

  if (cache) {
    console.info('Storing cache...')
  } else {
    process.exit()
  }
}
