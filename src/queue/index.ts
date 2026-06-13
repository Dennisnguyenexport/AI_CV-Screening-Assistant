import { Queue, Worker, type ConnectionOptions } from 'bullmq'
import IORedis from 'ioredis'
import { config } from '../config/index.js'
import { QUEUES, type CVParsingJob, type AIScreeningJob, type NotificationJob } from '../types/index.js'
import { parseCV, saveUploadedFile, cleanupUpload } from '../parser/index.js'
import { screenCV } from '../ai/index.js'
import {
  createCandidate,
  createApplication,
  updateApplicationStatus,
  getCandidateById,
  getApplicationById,
  getJobById,
  createScreening,
} from '../database/repository.js'
import { sendNotification, getDefaultChannels } from '../notifications/index.js'

// ===== Redis Connection =====
const connection: ConnectionOptions = {
  host: config.redis.host,
  port: config.redis.port,
  ...(config.redis.password ? { password: config.redis.password } : {}),
  maxRetriesPerRequest: null,
}

// Create Redis connection for BullMQ
export const redis = new IORedis({
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  maxRetriesPerRequest: null,
})

// ===== Queues =====
export const cvParsingQueue = new Queue<CVParsingJob>(QUEUES.CV_PARSING, { connection })
export const aiScreeningQueue = new Queue<AIScreeningJob>(QUEUES.AI_SCREENING, { connection })
export const notificationQueue = new Queue<NotificationJob>(QUEUES.NOTIFICATION, { connection })

// ===== Workers =====

/**
 * Worker 1: CV Parsing
 * Receives uploaded file path → extracts text → stores in DB
 */
const cvParsingWorker = new Worker<CVParsingJob>(
  QUEUES.CV_PARSING,
  async (job) => {
    const { application_id, candidate_id, cv_file_url } = job.data
    console.log(`📄 Parsing CV for candidate ${candidate_id}...`)

    const parsed = await parseCV(cv_file_url)

    // Store raw text to candidate record
    const { supabase } = await import('../database/client.js')
    const { error } = await supabase
      .from('candidates')
      .update({ cv_raw_text: parsed.raw_text })
      .eq('id', candidate_id)

    if (error) throw error

    // Update application status
    await updateApplicationStatus(application_id, 'screening')

    // Clean up uploaded file after parsing
    await cleanupUpload(cv_file_url)

    // Get the application to find job_id
    const app = await getApplicationById(application_id)
    if (!app) throw new Error(`Application ${application_id} not found`)

    const jobDesc = await getJobById(app.job_id)
    if (!jobDesc) throw new Error(`Job ${app.job_id} not found`)

    // Queue AI screening
    await aiScreeningQueue.add('screen', {
      application_id,
      cv_raw_text: parsed.raw_text,
      job_description: [jobDesc.title, jobDesc.description, jobDesc.requirements].filter(Boolean).join('\n'),
    })

    console.log(`✅ CV parsed for candidate ${candidate_id}`)
  },
  { connection },
)

/**
 * Worker 2: AI Screening
 * Analyzes CV text against JD → produces recommendation
 */
const aiScreeningWorker = new Worker<AIScreeningJob>(
  QUEUES.AI_SCREENING,
  async (job) => {
    const { application_id, cv_raw_text, job_description } = job.data
    console.log(`🤖 AI Screening for application ${application_id}...`)

    // Parse job description to extract title
    const lines = job_description.split('\n')
    const title = lines[0] || 'Unknown Position'

    const result = await screenCV({
      cvRawText: cv_raw_text,
      jobTitle: title,
      jobDescription: job_description,
    })

    // Save screening result
    await createScreening({
      application_id,
      ai_provider: `${config.ai.provider}/${config.ai.provider === 'deepseek' ? config.ai.deepseekModel || 'deepseek-chat' : config.ai.provider === 'openai' ? 'gpt-4o-mini' : 'gemini-2.0-flash'}`,
      recommendation: result.recommendation,
      score: result.score,
      summary: result.summary,
      strengths: result.strengths,
      weaknesses: result.weaknesses,
      risks: result.risks,
      skills_match: result.skills_match,
      raw_output: result.raw_output,
      processing_time_ms: Date.now() - job.timestamp,
    })

    // Update application status
    await updateApplicationStatus(application_id, 'screened')

    // Queue notifications
    await notificationQueue.add('notify', { application_id, channel: 'telegram' })

    console.log(`✅ AI Screening complete: ${result.recommendation} (${result.score}/100)`)
  },
  { connection },
)

/**
 * Worker 3: Notifications
 * Sends Telegram/Email notifications about screening results
 */
const notificationWorker = new Worker<NotificationJob>(
  QUEUES.NOTIFICATION,
  async (job) => {
    const { application_id, channel } = job.data
    console.log(`📨 Sending ${channel} notification for ${application_id}...`)

    const app = await getApplicationById(application_id)
    if (!app) throw new Error(`Application ${application_id} not found`)

    const candidate = await getCandidateById(app.candidate_id)
    if (!candidate) throw new Error(`Candidate ${app.candidate_id} not found`)

    const jobDesc = await getJobById(app.job_id)
    if (!jobDesc) throw new Error(`Job ${app.job_id} not found`)

    // Get screening result
    const { getScreeningByApplication } = await import('../database/repository.js')
    const screening = await getScreeningByApplication(application_id)
    if (!screening) throw new Error(`Screening for ${application_id} not found`)

    // For each configured notification channel
    const channels = getDefaultChannels()
    for (const ch of channels) {
      await sendNotification(
        {
          application_id,
          candidate_name: candidate.full_name,
          candidate_email: candidate.email,
          job_title: jobDesc.title,
          screening,
        },
        ch,
      )
    }

    console.log(`✅ ${channel} notification sent for ${application_id}`)
  },
  { connection },
)

// ===== Error handlers =====
cvParsingWorker.on('failed', (job, err) => {
  console.error(`❌ CV Parsing failed for job ${job?.id}:`, err.message)
})

aiScreeningWorker.on('failed', (job, err) => {
  console.error(`❌ AI Screening failed for job ${job?.id}:`, err.message)
})

notificationWorker.on('failed', (job, err) => {
  console.error(`❌ Notification failed for job ${job?.id}:`, err.message)
})

// ===== Graceful shutdown =====
export async function shutdownQueues(): Promise<void> {
  await cvParsingWorker.close()
  await aiScreeningWorker.close()
  await notificationWorker.close()
  await cvParsingQueue.close()
  await aiScreeningQueue.close()
  await notificationQueue.close()
  await redis.quit()
}
