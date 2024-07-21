const { existsSync } = require('fs')
const path = require('path')

function getOptions(target, options) {
  const disk = !!options.disk;
  const environment = options.environment
  const projectFolder = path.resolve(process.cwd(), options.cwd || '')
  const entry = existsSync(path.posix.resolve(projectFolder, `${target}.ts`)) ? `./${target}.ts` : `./${target}.js`
  const configFolder = __dirname
  const buildFolder = '.' + environment
  const cache = !options.skipCache
  const name = options.name || ''
  const trace = !!options.trace
  return {
    target,
    disk,
    buildFolder,
    entry,
    environment,
    cache,
    name,
    trace,
    projectFolder,
    configFolder,
    cwd: options.cwd
  }
}

function config(platform, argv) {
  const options = getOptions(platform, argv);
  return {
    context: options.projectFolder,
    mode: require('./webpack/mode')(options),
    infrastructureLogging: require('./webpack/infrastructureLogging')(options),
    entry: require('./webpack/entry')(options),
    output: require('./webpack/output')(options),
    resolve: require('./webpack/resolve')(options),
    optimization: require('./webpack/optimization')(options),
    devtool: require('./webpack/devtool')(options),
    stats: require('./webpack/stats')(options),
    target: require('./webpack/target')(options),
    externals: require('./webpack/externals')(options),
    node: require('./webpack/node')(options),
    cache: require('./webpack/cache')(options),
    module: require('./webpack/module')(options),
    plugins: require('./webpack/plugins')(options),
    experiments: require('./webpack/experiments')(options),
  }
}

function server(_env, argv) {
  return config('server', argv)
}

function client(_env, argv) {
  return config('client', argv)
}

module.exports = [server, client]