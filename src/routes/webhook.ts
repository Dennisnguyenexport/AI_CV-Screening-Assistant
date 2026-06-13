import type { FastifyInstance, FastifyRequest } from 'fastify'
import { supabase } from '../database/client.js'
import {
  createCandidate,
  createApplication,
  getCandidateByEmail,
  getActiveJobs,
  getJobById,
} from '../database/repository.js'
import { cvParsingQueue } from '../queue/index.js'
import type { TallyWebhookPayload } from '../types/index.js'

/**
 * POST /webhook/tally
 * Receives CV submissions from Tally Form
 */
export async function tallyWebhookRoutes(app: FastifyInstance) {
  app.post('/webhook/tally', async (req: FastifyRequest<{ Body: TallyWebhookPayload }>, reply) => {
    try {
      const { fields } = req.body

      // Extract fields from Tally form submission
      const fieldMap = new Map<string, unknown>()
      for (const field of fields) {
        fieldMap.set(field.key, field.value)
      }

      // Map Tally fields to candidate data
      const fullName = String(fieldMap.get('full_name') || fieldMap.get('name') || fieldMap.get('ho_ten') || '')
      const email = String(fieldMap.get('email') || fieldMap.get('Email') || '').toLowerCase().trim()
      const phone = String(fieldMap.get('phone') || fieldMap.get('dien_thoai') || '')
      const jobId = String(fieldMap.get('job_id') || fieldMap.get('vi_tri') || '')
      const cvFileUrl = String(fieldMap.get('cv') || fieldMap.get('cv_file') || fieldMap.get('file_cv') || '')

      // Validate required fields
      if (!fullName || !email) {
        return reply.status(400).send({
          success: false,
          error: 'Missing required fields: full_name and email are required',
        })
      }

      // Check for existing candidate by email
      let candidate = await getCandidateByEmail(email)

      if (!candidate) {
        // Create new candidate
        candidate = await createCandidate({
          full_name: fullName,
          email,
          phone: phone || undefined,
          cv_file_url: cvFileUrl || undefined,
          source: 'tally',
          source_meta: {
            form_id: req.body.formId,
            form_name: req.body.formName,
            submission_id: req.body.submissionId,
          },
        })
      }

      // Find job
      let targetJobId = jobId
      if (!targetJobId) {
        // No job specified, use first active job
        const jobs = await getActiveJobs()
        if (jobs.length === 0) {
          return reply.status(400).send({
            success: false,
            error: 'No active jobs found. Please create a job first or specify job_id.',
          })
        }
        targetJobId = jobs[0].id
      } else {
        // Verify job exists
        const job = await getJobById(targetJobId)
        if (!job) {
          return reply.status(400).send({
            success: false,
            error: `Job with id ${targetJobId} not found. Available jobs: call GET /api/jobs`,
          })
        }
      }

      // Create application
      const application = await createApplication({
        candidate_id: candidate.id,
        job_id: targetJobId,
      })

      // Queue CV for parsing
      await cvParsingQueue.add('parse', {
        application_id: application.id,
        candidate_id: candidate.id,
        cv_file_url: cvFileUrl || '',
      })

      console.log(`📥 Tally submission: ${fullName} -> ${application.id}`)

      return reply.status(200).send({
        success: true,
        application_id: application.id,
        candidate_id: candidate.id,
        message: 'CV submitted successfully. Screening in progress.',
      })
    } catch (err) {
      console.error('❌ Tally webhook error:', err)
      return reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      })
    }
  })
}
