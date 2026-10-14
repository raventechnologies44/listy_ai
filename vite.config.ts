// @ts-nocheck
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import {
  generateAiText,
  parseAiRequestBody,
  verifySupabaseUser,
} from './server/ai-generate.mjs'
import marketHandler from './api/market.js'

function aiApiDevPlugin(): Plugin {
  return {
    name: 'listyai-ai-api-dev',
    configureServer(server) {
      server.middlewares.use('/api/ai/status', (req, res) => {
        if (req.method !== 'GET') {
          res.statusCode = 405
          res.end(JSON.stringify({ error: 'Method not allowed' }))
          return
        }
        const env = loadEnv(server.config.mode, process.cwd(), '')
        void verifySupabaseUser({
          authHeader: req.headers.authorization,
          supabaseUrl: env.VITE_SUPABASE_URL,
          supabaseAnonKey: env.VITE_SUPABASE_ANON_KEY,
        }).then((auth) => {
          if (!auth.ok) {
            res.statusCode = auth.status
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: auth.error, configured: false }))
            return
          }
          res.statusCode = 200
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ configured: Boolean(env.ANTHROPIC_API_KEY) }))
        })
      })

      server.middlewares.use('/api/ai/generate', (req, res, next) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end(JSON.stringify({ error: 'Method not allowed' }))
          return
        }
        const env = loadEnv(server.config.mode, process.cwd(), '')
        let raw = ''
        req.on('data', (chunk) => {
          raw += chunk
        })
        req.on('end', () => {
          void (async () => {
            const auth = await verifySupabaseUser({
              authHeader: req.headers.authorization,
              supabaseUrl: env.VITE_SUPABASE_URL,
              supabaseAnonKey: env.VITE_SUPABASE_ANON_KEY,
            })
            if (!auth.ok) {
              res.statusCode = auth.status
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: auth.error }))
              return
            }
            try {
              const body = JSON.parse(raw || '{}')
              const parsed = parseAiRequestBody(body)
              const text = await generateAiText({
                task: parsed.task,
                payload: parsed,
                apiKey: env.ANTHROPIC_API_KEY,
                model: env.ANTHROPIC_MODEL,
              })
              res.statusCode = 200
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ text }))
            } catch (err) {
              const message = err instanceof Error ? err.message : 'Generation failed'
              res.statusCode = 400
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: message }))
            }
          })().catch(next)
        })
      })
    },
  }
}

function marketApiDevPlugin(): Plugin {
  return {
    name: 'listymarket-api-dev',
    configureServer(server) {
      server.middlewares.use('/api/market', (req, res) => {
        const env = loadEnv(server.config.mode, process.cwd(), '')
        for (const [k, v] of Object.entries(env)) {
          if (process.env[k] === undefined) process.env[k] = v
        }
        let raw = ''
        req.on('data', (chunk) => {
          raw += chunk
        })
        req.on('end', () => {
          req.body = raw
          res.status = (code) => {
            res.statusCode = code
            return res
          }
          res.json = (obj) => {
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(obj))
          }
          void marketHandler(req, res)
        })
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), aiApiDevPlugin(), marketApiDevPlugin()],
})
