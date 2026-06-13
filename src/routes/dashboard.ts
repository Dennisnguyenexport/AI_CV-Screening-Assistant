import type { FastifyInstance } from 'fastify'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dashboardHtmlPath = path.resolve(__dirname, '../../public/dashboard.html')

/**
 * Serve the dashboard SPA
 */
export async function dashboardRoutes(app: FastifyInstance) {
  // Serve static dashboard
  app.get('/dashboard', async (_req, reply) => {
    try {
      const html = fs.readFileSync(dashboardHtmlPath, 'utf-8')
      return reply.type('text/html').send(html)
    } catch {
      return reply.status(200).send({
        message: 'Dashboard not built yet. Use the API directly.',
        endpoints: {
          stats: '/api/stats',
          applications: '/api/applications',
          jobs: '/api/jobs',
          health: '/api/health',
        },
      })
    }
  })

  // Redirect root to dashboard
  app.get('/', async (_req, reply) => {
    return reply.redirect('/dashboard')
  })
}
