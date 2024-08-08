#! /usr/bin/env node
const { program } = require('commander')
const dotenv = require('dotenv')
const { existsSync, readdirSync, unlinkSync } = require('fs')
const path = require('path')
const webpack = require(`webpack`)

let directory = process.cwd()

const { version } = require('../package.json')
const customConfig = () => path.resolve(directory, 'webpack.config.js')
const nullstackConfig = path.resolve(process.cwd(), 'node_modules', 'nullstack', 'webpack.config.js')
const config = () => {
  const cfg = customConfig()
  
  if (!existsSync(cfg)) {
    return require(nullstackConfig)
  }

  return require(cfg)
}

function setDirectory(dir) {
  directory = dir
}

function getConfig(options) {
  return config().map((env) => env(null, options))
}

function getCompiler(options) {
  return webpack(getConfig(options))
}

function loadEnv(name) {
  let envPath = '.env'
  if (name) {
    envPath += `.${name}`
  }
  dotenv.config({ path: path.resolve(directory, envPath) })
}

function clearDir() {
  if (existsSync(path.join(directory, '.development'))) {
    const tempFiles = readdirSync(path.resolve(directory, '.development'))
    for (const file of tempFiles) {
      if (file !== '.cache') {
        unlinkSync(path.join(directory, '.development', file))
      }
    }
  }
}

async function start({ port, name, disk, skipCache, trace, cwd }) {
  if (cwd) {
    process.env.__NULLSTACK_CLI_CWD = cwd
    setDirectory(path.resolve(process.cwd(), cwd))
  }

  process.env.__NULLSTACK_TRACE = (!!trace).toString()
  const progress = require('../builders/logger')('server', 'development')
  loadEnv(cwd, name)
  const environment = 'development'
  process.env.NULLSTACK_ENVIRONMENT_MODE = 'spa'
  process.env.NULLSTACK_ENVIRONMENT_DISK = (!!disk).toString()
  process.env.__NULLSTACK_CLI_ENVIRONMENT = environment
  if (name) {
    process.env.NULLSTACK_ENVIRONMENT_NAME = name
  }
  if (port) {
    process.env.NULLSTACK_SERVER_PORT = port
  }
  if (!process.env.NULLSTACK_PROJECT_DOMAIN) process.env.NULLSTACK_PROJECT_DOMAIN = 'localhost'
  if (!process.env.NULLSTACK_WORKER_PROTOCOL) process.env.NULLSTACK_WORKER_PROTOCOL = 'http'
  const settings = config(cwd)[0](null, { environment, disk, skipCache, name, trace, cwd })
  const compiler = webpack(settings)
  clearDir()
  compiler.watch({ aggregateTimeout: 200, hot: true, ignored: /node_modules/ }, (error, stats) => {
    progress.stop()
    if (error) {
      console.error(error.stack || error)
      if (error.details) {
        console.error(error.details)
      }
    } else if (stats.hasErrors()) {
      console.info(stats.toString({ colors: true, warnings: false, logging: false, assets: false, modules: false }))
    }
  })
}

function build({ mode = 'ssr', output, name, skipCache, cwd }) {
  if (cwd) {
    setDirectory(path.resolve(process.cwd(), cwd))
  }

  const environment = 'production'
  const progress = require('../builders/logger')('application', environment)
  const compiler = getCompiler({ environment, skipCache, name, cwd })
  if (name) {
    process.env.NULLSTACK_ENVIRONMENT_NAME = name
  }


  compiler.run((error, stats) => {
    if (error) {
      console.error(error.stack || error)
      if (error.details) {
        console.error(error.details)
      }
    } else if (stats.hasErrors()) {
      console.info(stats.toString({ colors: true }))
      process.exit(1)
    }
    if (stats.hasErrors()) process.exit(1)
    progress.stop()
    require(`../builders/${mode}`)({ output, environment, cwd: directory })
  })
}

program
  .command('start')
  .alias('s')
  .description('Start application in development environment')
  .option('-p, --port <port>', 'Port number to run the server')
  .option('-n, --name <name>', 'Name of the environment. Affects which .env file that will be loaded')
  .option('-d, --disk', 'Write files to disk')
  .option('-sc, --skip-cache', 'Skip loding and building cache in .development folder')
  .option('-t, --trace', 'Trace file compilation')
  .option('-c, --cwd <directory>', 'Start a Nullstack app in another directory')
  .helpOption('-h, --help', 'Learn more about this command')
  .action(start)

program
  .command('build')
  .alias('b')
  .description('Build application for production environment')
  .addOption(new program.Option('-m, --mode <mode>', 'Build production bundles').choices(['ssr', 'spa', 'ssg']))
  .option('-o, --output <output>', 'Path to build output folder')
  .option('-n, --name <name>', 'Name of the environment. Affects which .env file that will be loaded')
  .option('-sc, --skip-cache', 'Skip loding and building cache in .production folder')
  .option('-c, --cwd <directory>', 'Build a Nullstack app in another directory')
  .helpOption('-h, --help', 'Learn more about this command')
  .action(build)

program
  .name('nullstack')
  .addHelpCommand(false)
  .helpOption('-h, --help', 'Learn more about a specific command')
  .version(version, '-v, --version', 'Nullstack version being used')
  .parse(process.argv)
