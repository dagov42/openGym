// The route modules that live beside server.js. Tests that read route source (OpenAPI parity,
// audit event names, state-read cost) must not grow a new hard-coded list every time one of these
// moves out of server.js: add the module here once.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const API = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

export const ROOT_ROUTE_MODULES = [
  'server.js',
  'admin-routes.js',
  'admin-user-routes.js',
  'calendar-routes.js',
  'push-routes.js',
  'watch-routes.js',
]

export const readRouteModule = name => fs.readFileSync(path.join(API, name), 'utf8')

export const routeSource = () => ROOT_ROUTE_MODULES.map(readRouteModule).join('\n')

// A handler runs from its `'METHOD /path':` key to the next route key (or the end of the source).
export function handlerIn(source, key) {
  const at = source.indexOf(`'${key}':`)
  if (at < 0) return null
  const end = source.indexOf("\n  '", at + 1)
  return source.slice(at, end === -1 ? undefined : end)
}
