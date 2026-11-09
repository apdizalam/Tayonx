import react from '@vitejs/plugin-react'
import { createLogger, defineConfig } from 'vite'

// Override with TAYONX_API_PROXY=http://localhost:5050 to point the dev proxy elsewhere.
const BACKEND = process.env.TAYONX_API_PROXY || 'http://localhost:5000'

// While the backend restarts (nodemon reloads it on every save, ~2 s), requests can't reach it.
// Instead of a full ECONNREFUSED stack trace per request, the proxy answers with a clean 503
// that the app retries (see src/lib/api.js) and logs one short line at most every few seconds.
const isRefused = (error) => Boolean(error) && (error.code === 'ECONNREFUSED' || error.errors?.some((item) => item.code === 'ECONNREFUSED'))

let lastProxyWarning = 0
function quietProxyErrors(proxy) {
  proxy.on('error', (error, _req, res) => {
    const now = Date.now()
    if (now - lastProxyWarning > 5000) {
      lastProxyWarning = now
      console.warn(`[vite] backend at ${BACKEND} is ${isRefused(error) ? 'not running yet (starting or restarting)' : `unreachable: ${error.message}`}; requests will retry.`)
    }
    // `res` is a ServerResponse for HTTP requests and a Socket for WebSocket upgrades.
    if (res && typeof res.writeHead === 'function' && !res.headersSent) {
      res.writeHead(503, { 'Content-Type': 'application/json', 'Retry-After': '1' })
      res.end(JSON.stringify({ error: 'The Tayonx server is restarting. Please try again in a moment.', code: 'server_restarting' }))
    }
  })
}

// Vite also logs every proxy error with a stack trace. Skip only the "backend not running"
// ones (already summarised above); every other error is still printed.
const logger = createLogger()
const logError = logger.error
logger.error = (message, options) => {
  if (/proxy (socket )?error/.test(String(message)) && isRefused(options?.error)) return
  logError(message, options)
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  customLogger: logger,
  server: {
    proxy: {
      '/api': { target: BACKEND, changeOrigin: true, configure: quietProxyErrors },
      '/socket.io': {
        target: BACKEND,
        ws: true,
        configure: quietProxyErrors,
      },
    },
  },
})
