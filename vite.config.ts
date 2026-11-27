import { existsSync, readFileSync } from 'node:fs'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { gantryMarkup } from './src/ui/gantry'

/**
 * The loading screen from the very first frame: its styles go straight into
 * the page's <head> and the start gantry into its body, before the rest of the
 * styles and the game's code have even arrived.
 */
const loadingScreen = (): Plugin => ({
  name: 'loading-screen',
  transformIndexHtml: (html) => {
    const css = readFileSync(new URL('./src/ui/loading.css', import.meta.url), 'utf8')
    return html.replace('</head>', `<style>${css}</style>\n  </head>`).replace('<!-- gantry -->', gantryMarkup())
  },
})

/**
 * The leaderboard API (api/*.ts) under `npm run dev`, from the same files Vercel runs as
 * functions: /api/<name> loads api/<name>.ts and calls its GET or POST with a standard Request.
 */
const apiRoutes = (): Plugin => ({
  name: 'api-routes',
  configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)
      const route = /^\/api\/([a-z-]+)$/.exec(url.pathname)?.[1]
      if (!route) return next()
      const file = new URL(`./api/${route}.ts`, import.meta.url)
      if (!existsSync(file)) return next()
      try {
        const handlers = await server.ssrLoadModule(`/api/${route}.ts`)
        const method = req.method ?? 'GET'
        const handler = handlers[method]
        if (typeof handler !== 'function') {
          res.statusCode = 405
          res.end()
          return
        }
        const chunks: Buffer[] = []
        for await (const chunk of req) chunks.push(chunk as Buffer)
        const headers = new Headers()
        for (const [key, value] of Object.entries(req.headers)) if (value !== undefined) headers.set(key, String(value))
        const request = new Request(url, { method, headers, body: method === 'GET' || method === 'HEAD' ? undefined : Buffer.concat(chunks) })
        const response: Response = await handler(request)
        res.statusCode = response.status
        response.headers.forEach((value, key) => res.setHeader(key, value))
        res.end(Buffer.from(await response.arrayBuffer()))
      } catch (error) {
        next(error)
      }
    })
  },
})

export default defineConfig(({ mode }) => {
  // The API's settings (DATABASE_URL, LAP_SALT) from .env.local, for the dev server's API routes.
  // Only the server sees them: the game's code only gets variables starting with VITE_.
  const env = loadEnv(mode, process.cwd(), '')
  for (const key of ['DATABASE_URL', 'LAP_SALT']) if (env[key] && !process.env[key]) process.env[key] = env[key]

  return {
    plugins: [react(), loadingScreen(), apiRoutes()],
  }
})
