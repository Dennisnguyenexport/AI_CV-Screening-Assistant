import type { FastifyInstance, FastifyRequest } from 'fastify'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { createCandidate, createApplication, getActiveJobs } from '../database/repository.js'
import { cvParsingQueue } from '../queue/index.js'
import { saveUploadedFile } from '../parser/index.js'

/**
 * POST /api/cv/upload
 * Direct CV upload endpoint (for dashboard/manual upload)
 */
export async function cvRoutes(app: FastifyInstance) {
  // Register multipart for file uploads
  await app.register((await import('@fastify/multipart')).default, {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB
      files: 1,
    },
  })

  app.post('/api/cv/upload', async (req: FastifyRequest, reply) => {
    try {
      const data = await req.file()
      if (!data) {
        return reply.status(400).send({ success: false, error: 'No file uploaded' })
      }

      const buffer = await data.toBuffer()
      const fileName = data.filename

      // Validate file type
      const ext = path.extname(fileName).toLowerCase()
      if (ext !== '.pdf' && ext !== '.docx') {
        return reply.status(400).send({
          success: false,
          error: 'Unsupported file type. Only PDF and DOCX are supported.',
        })
      }

      // Get form fields (sent alongside the file)
      const fields: Record<string, string> = {}
      if (data.fields) {
        for (const [key, value] of Object.entries(data.fields)) {
          fields[key] = String(value)
        }
      }

      const fullName = fields.full_name || fields.name || 'Unknown'
      const email = (fields.email || '').toLowerCase().trim()
      const phone = fields.phone || ''
      const jobId = fields.job_id || ''

      if (!email) {
        return reply.status(400).send({
          success: false,
          error: 'Email is required in form fields',
        })
      }

      // Create candidate
      const candidate = await createCandidate({
        full_name: fullName,
        email,
        phone: phone || undefined,
        source: 'upload',
      })

      // Save file
      const filePath = await saveUploadedFile(buffer, fileName, candidate.id)

      // Find job
      let targetJobId = jobId
      if (!targetJobId) {
        const jobs = await getActiveJobs()
        if (jobs.length > 0) {
          targetJobId = jobs[0].id
        }
      }

      if (!targetJobId) {
        return reply.status(400).send({
          success: false,
          error: 'No job specified and no active jobs found. Please specify job_id or create a job first.',
        })
      }

      // Create application
      const application = await createApplication({
        candidate_id: candidate.id,
        job_id: targetJobId,
      })

      // Queue CV parsing
      await cvParsingQueue.add('parse', {
        application_id: application.id,
        candidate_id: candidate.id,
        cv_file_url: filePath,
      })

      console.log(`📤 CV uploaded: ${fileName} -> ${application.id}`)

      return reply.status(200).send({
        success: true,
        application_id: application.id,
        candidate_id: candidate.id,
        message: 'CV uploaded successfully. Processing started.',
        file_name: fileName,
      })
    } catch (err) {
      console.error('❌ CV upload error:', err)
      return reply.status(500).send({
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      })
    }
  })
}
