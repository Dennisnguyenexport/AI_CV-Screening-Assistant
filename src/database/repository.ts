import { supabase } from './client.js'
import type {
  Candidate, Job, Application, ScreeningResult,
  Notification, User, ApplicationStatus, NotificationChannel,
} from '../types/index.js'

// ===== Candidates =====

export async function createCandidate(data: {
  full_name: string
  email: string
  phone?: string
  cv_file_url?: string
  source: Candidate['source']
  source_meta?: Record<string, unknown>
}): Promise<Candidate> {
  const { data: result, error } = await supabase
    .from('candidates')
    .insert(data)
    .select()
    .single()

  if (error) throw new Error(`Failed to create candidate: ${error.message}`)
  return result
}

export async function getCandidateById(id: string): Promise<Candidate | null> {
  const { data, error } = await supabase
    .from('candidates')
    .select()
    .eq('id', id)
    .single()

  if (error && error.code !== 'PGRST116') throw error
  return data
}

export async function getCandidateByEmail(email: string): Promise<Candidate | null> {
  const { data, error } = await supabase
    .from('candidates')
    .select()
    .eq('email', email)
    .maybeSingle()

  if (error) throw error
  return data
}

// ===== Jobs =====

export async function getActiveJobs(): Promise<Job[]> {
  const { data, error } = await supabase
    .from('jobs')
    .select()
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

export async function getJobById(id: string): Promise<Job | null> {
  const { data, error } = await supabase
    .from('jobs')
    .select()
    .eq('id', id)
    .single()

  if (error && error.code !== 'PGRST116') throw error
  return data
}

// ===== Applications =====

export async function createApplication(data: {
  candidate_id: string
  job_id: string
  status?: ApplicationStatus
  notes?: string
}): Promise<Application> {
  const { data: result, error } = await supabase
    .from('applications')
    .insert(data)
    .select()
    .single()

  if (error) throw new Error(`Failed to create application: ${error.message}`)
  return result
}

export async function updateApplicationStatus(
  id: string,
  status: ApplicationStatus,
  notes?: string,
): Promise<void> {
  const update: Record<string, unknown> = { status }
  if (notes !== undefined) update.notes = notes

  const { error } = await supabase
    .from('applications')
    .update(update)
    .eq('id', id)

  if (error) throw new Error(`Failed to update application: ${error.message}`)
}

export async function getApplicationById(id: string): Promise<Application | null> {
  const { data, error } = await supabase
    .from('applications')
    .select()
    .eq('id', id)
    .single()

  if (error && error.code !== 'PGRST116') throw error
  return data
}

export async function getApplicationsByJob(jobId: string): Promise<Application[]> {
  const { data, error } = await supabase
    .from('applications')
    .select()
    .eq('job_id', jobId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

export async function listApplications(options?: {
  status?: ApplicationStatus
  limit?: number
  offset?: number
}): Promise<Application[]> {
  let query = supabase
    .from('applications')
    .select('*, candidates(full_name, email, phone), jobs(title, department)')
    .order('created_at', { ascending: false })

  if (options?.status) query = query.eq('status', options.status)
  if (options?.limit) query = query.limit(options.limit)
  if (options?.offset) query = query.range(options.offset, options.offset + (options.limit || 20) - 1)

  const { data, error } = await query
  if (error) throw error
  return data || []
}

// ===== Screenings =====

export async function createScreening(data: {
  application_id: string
  ai_provider: string
  recommendation: ScreeningResult['recommendation']
  score: number
  summary: string
  strengths: string[]
  weaknesses: string[]
  risks: string[]
  skills_match: Record<string, number>
  raw_output: string
  processing_time_ms: number
}): Promise<ScreeningResult> {
  const { data: result, error } = await supabase
    .from('screenings')
    .insert(data)
    .select()
    .single()

  if (error) throw new Error(`Failed to create screening: ${error.message}`)
  return result
}

export async function getScreeningByApplication(applicationId: string): Promise<ScreeningResult | null> {
  const { data, error } = await supabase
    .from('screenings')
    .select()
    .eq('application_id', applicationId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (error && error.code !== 'PGRST116') throw error
  return data
}

// ===== Notifications =====

export async function createNotification(data: {
  application_id: string
  channel: NotificationChannel
  to_address: string
  subject?: string
  body: string
}): Promise<Notification> {
  const { data: result, error } = await supabase
    .from('notifications')
    .insert(data)
    .select()
    .single()

  if (error) throw new Error(`Failed to create notification: ${error.message}`)
  return result
}

export async function updateNotificationStatus(
  id: string,
  status: Notification['status'],
  error?: string,
): Promise<void> {
  const update: Record<string, unknown> = { status }
  if (error !== undefined) update.error = error
  if (status === 'sent') update.sent_at = new Date().toISOString()

  const { error: dbError } = await supabase
    .from('notifications')
    .update(update)
    .eq('id', id)

  if (dbError) throw new Error(`Failed to update notification: ${dbError.message}`)
}

// ===== Dashboard Stats =====

export async function getDashboardStats() {
  const { data: applications, error } = await supabase
    .from('applications')
    .select('status')

  if (error) throw error

  const total = applications.length
  return {
    total_candidates: total,
    new: applications.filter(a => a.status === 'new').length,
    screening: applications.filter(a => a.status === 'screening').length,
    screened: applications.filter(a => a.status === 'screened').length,
    shortlisted: applications.filter(a => a.status === 'shortlisted').length,
    interview: applications.filter(a => a.status === 'interview').length,
    rejected: applications.filter(a => a.status === 'rejected').length,
    hired: applications.filter(a => a.status === 'hired').length,
  }
}
