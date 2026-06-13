import type { FastifyInstance } from 'fastify'
import {
  listApplications,
  getApplicationById,
  getCandidateById,
  getJobById,
  getActiveJobs,
  getScreeningByApplication,
  updateApplicationStatus,
  getDashboardStats,
} from '../database/repository.js'
import type { ApplicationStatus } from '../types/index.js'

/**
 * REST API routes for dashboard
 */
export async function apiRoutes(app: FastifyInstance) {
  // ===== Dashboard Stats =====
  app.get('/api/stats', async (_req, reply) => {
    try {
      const stats = await getDashboardStats()
      return reply.send(stats)
    } catch (err) {
      console.error('❌ Stats error:', err)
      return reply.status(500).send({ error: 'Failed to fetch stats' })
    }
  })

  // ===== List Applications =====
  app.get('/api/applications', async (req, reply) => {
    try {
      const query = req.query as Record<string, string>
      const applications = await listApplications({
        status: query.status as ApplicationStatus | undefined,
        limit: Number(query.limit) || 50,
        offset: Number(query.offset) || 0,
      })
      return reply.send(applications)
    } catch (err) {
      console.error('❌ List applications error:', err)
      return reply.status(500).send({ error: 'Failed to fetch applications' })
    }
  })

  // ===== Get Application Detail =====
  app.get('/api/applications/:id', async (req, reply) => {
    try {
      const { id } = req.params as { id: string }
      const app = await getApplicationById(id)
      if (!app) return reply.status(404).send({ error: 'Application not found' })

      const candidate = await getCandidateById(app.candidate_id)
      const job = await getJobById(app.job_id)
      const screening = await getScreeningByApplication(id)

      return reply.send({
        application: app,
        candidate,
        job,
        screening,
      })
    } catch (err) {
      console.error('❌ Get application error:', err)
      return reply.status(500).send({ error: 'Failed to fetch application' })
    }
  })

  // ===== Update Application Status =====
  app.patch('/api/applications/:id/status', async (req, reply) => {
    try {
      const { id } = req.params as { id: string }
      const { status, notes } = req.body as { status: ApplicationStatus; notes?: string }

      if (!status) {
        return reply.status(400).send({ error: 'Status is required' })
      }

      await updateApplicationStatus(id, status, notes)
      return reply.send({ success: true })
    } catch (err) {
      console.error('❌ Update status error:', err)
      return reply.status(500).send({ error: 'Failed to update status' })
    }
  })

  // ===== List Active Jobs =====
  app.get('/api/jobs', async (_req, reply) => {
    try {
      const jobs = await getActiveJobs()
      return reply.send(jobs)
    } catch (err) {
      console.error('❌ List jobs error:', err)
      return reply.status(500).send({ error: 'Failed to fetch jobs' })
    }
  })

  // ===== Health Check =====
  app.get('/api/health', async (_req, reply) => {
    return reply.send({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    })
  })
}
