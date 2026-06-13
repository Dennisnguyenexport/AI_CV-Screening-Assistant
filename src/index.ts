import Fastify from 'fastify'
import { config } from './config/index.js'
import { tallyWebhookRoutes } from './routes/webhook.js'
import { cvRoutes } from './routes/cv.js'
import { apiRoutes } from './routes/api.js'
import { dashboardRoutes } from './routes/dashboard.js'

async function main() {
  const app = Fastify({
    logger: {
      transport: config.nodeEnv === 'development'
        ? { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } }
        : undefined,
    },
  })

  // CORS for dashboard
  await app.register((await import('@fastify/cors')).default, {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  })

  // Register routes
  await tallyWebhookRoutes(app)
  await cvRoutes(app)
  await apiRoutes(app)
  await dashboardRoutes(app)

  // Graceful shutdown
  const shutdown = async () => {
    console.log('\n🛑 Shutting down...')
    try {
      const { shutdownQueues } = await import('./queue/index.js')
      await shutdownQueues()
    } catch {
      // queue might not be initialized
    }
    await app.close()
    process.exit(0)
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)

  // Start server
  try {
    await app.listen({ port: config.port, host: config.host })
    console.log(`\n🚀 AI CV Screening Assistant v1.0.0`)
    console.log(`📡 Server: http://${config.host}:${config.port}`)
    console.log(`🏥 Health: http://localhost:${config.port}/api/health`)
    console.log(`📊 Dashboard: http://localhost:${config.port}/dashboard`)
    console.log(`🤖 AI Engine: ${config.ai.provider.toUpperCase()}`)
    console.log(`📨 Notifications: ${config.telegram.botToken ? 'Telegram ✓' : 'Telegram ✗'} | ${config.email.host ? 'Email ✓' : 'Email ✗'}\n`)
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

main()
