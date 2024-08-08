const registry = {}
export default registry
import { getCurrentContext } from "./context"
import Nullstack from '.'
import { load } from "./lazy"

const getHashPrefix = () => {
  const cwd = process.env.__NULLSTACK_CLI_CWD
  if (!cwd) return ''

  const folders = cwd.split('/').filter(dir => dir && dir !== '.')

  return `${folders.join('__')}__`
}

export function register(klass, functionName) {
  const prefix = getHashPrefix()

  if (functionName) {
    registry[`${prefix}${klass.hash}.${functionName}`] = klass[functionName]
  } else {
    registry[`${prefix}${klass.hash}`] = klass
    bindStaticProps(klass)
  }
}

function bindStaticProps(klass) {
  let parent = klass
  while (parent !== Nullstack) {
    const props = Object.getOwnPropertyNames(parent)
    for (const prop of props) {
      if (prop === 'caller' || prop === 'callee' || prop === 'arguments') continue
      const underscored = prop.startsWith('_')
      if (typeof klass[prop] === 'function') {
        if (!underscored && !registry[`${parent.hash}.${prop}`]) {
          return
        }
        const propName = `__NULLSTACK_${prop}`
        if (!klass[propName]) {
          klass[propName] = klass[prop]
        }
        async function _invoke(...args) {
          if (underscored) {
            return klass[propName].call(klass, ...args)
          }
          const params = args[0] || {}
          const currentContext = getCurrentContext(params)
          await load(klass.hash)
          return klass[propName].call(klass, currentContext)
        }
        if (module.hot) {
          _invoke.hash = klass[prop].hash
        }
        klass[prop] = _invoke
        klass.prototype[prop] = _invoke
      }
    }
    parent = Object.getPrototypeOf(parent)
  }
}