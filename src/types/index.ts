// ===== Core Domain Types =====

export interface Candidate {
  id: string
  full_name: string
  email: string
  phone?: string
  cv_file_url?: string
  cv_raw_text?: string
  source: 'tally' | 'upload' | 'email' | 'zalo' | 'facebook' | 'messenger' | 'platform'
  source_meta?: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface Job {
  id: string
  title: string
  department?: string
  description: string // JD text
  requirements?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export type ApplicationStatus =
  | 'new'
  | 'screening'
  | 'screened'
  | 'shortlisted'
  | 'interview'
  | 'offered'
  | 'hired'
  | 'rejected'
  | 'withdrawn'

export interface Application {
  id: string
  candidate_id: string
  job_id: string
  status: ApplicationStatus
  notes?: string
  created_at: string
  updated_at: string
}

export interface ScreeningResult {
  id: string
  application_id: string
  ai_provider: string
  recommendation: 'interview' | 'shortlist' | 'review' | 'reject'
  score: number // 0-100
  summary: string
  strengths: string[]
  weaknesses: string[]
  risks: string[]
  skills_match: Record<string, number> // skill -> confidence
  raw_output: string
  processing_time_ms: number
  created_at: string
}

export type NotificationChannel = 'telegram' | 'email'
export type NotificationStatus = 'pending' | 'sent' | 'failed'

export interface Notification {
  id: string
  application_id: string
  channel: NotificationChannel
  to: string
  subject?: string
  body: string
  status: NotificationStatus
  error?: string
  sent_at?: string
  created_at: string
}

export interface User {
  id: string
  email: string
  name: string
  role: 'admin' | 'hr'
  telegram_chat_id?: string
  created_at: string
}

// ===== API Types =====

export interface TallyWebhookPayload {
  formId: string
  formName: string
  submissionId: string
  createdAt: string
  fields: Array<{
    key: string
    label: string
    type: string
    value: unknown
  }>
}

export interface UploadCVResponse {
  application_id: string
  candidate_id: string
  status: 'queued' | 'processing' | 'completed' | 'failed'
  message: string
}

export interface ScreeningResponse {
  application_id: string
  recommendation: ScreeningResult['recommendation']
  score: number
  summary: string
  strengths: string[]
  weaknesses: string[]
  risks: string[]
}

// ===== Queue Types =====

export const QUEUES = {
  CV_PARSING: 'cv-parsing',
  AI_SCREENING: 'ai-screening',
  NOTIFICATION: 'notification',
} as const

export interface CVParsingJob {
  application_id: string
  candidate_id: string
  cv_file_url: string
}

export interface AIScreeningJob {
  application_id: string
  cv_raw_text: string
  job_description: string
}

export interface NotificationJob {
  application_id: string
  channel: NotificationChannel
}

// ===== Config Types =====

export interface AppConfig {
  port: number
  host: string
  nodeEnv: string
  supabase: {
    url: string
    anonKey: string
    serviceRoleKey?: string
  }
  redis: {
    host: string
    port: number
    password?: string
  }
  ai: {
    provider: 'gemini' | 'openai' | 'deepseek'
    geminiApiKey?: string
    openaiApiKey?: string
    deepseekApiKey?: string
    deepseekModel?: string
  }
  telegram: {
    botToken?: string
    chatId?: string
  }
  email: {
    host?: string
    port?: number
    user?: string
    pass?: string
    from?: string
  }
  upload: {
    dir: string
    maxFileSize: number // bytes
  }
}
