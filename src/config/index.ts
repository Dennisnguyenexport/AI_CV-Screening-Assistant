import 'dotenv/config'
import type { AppConfig } from '../types/index.js'

function env(key: string, fallback?: string): string {
  const value = process.env[key] ?? fallback
  if (!value && fallback === undefined) {
    throw new Error(`Missing required env var: ${key}`)
  }
  return value!
}

function envOptional(key: string): string | undefined {
  return process.env[key] || undefined
}

function envInt(key: string, fallback: number): number {
  const value = process.env[key]
  return value ? parseInt(value, 10) : fallback
}

export const config: AppConfig = {
  port: envInt('PORT', 3000),
  host: env('HOST', '0.0.0.0'),
  nodeEnv: env('NODE_ENV', 'development'),
  supabase: {
    url: env('SUPABASE_URL'),
    anonKey: env('SUPABASE_ANON_KEY'),
    serviceRoleKey: envOptional('SUPABASE_SERVICE_ROLE_KEY'),
  },
  redis: {
    host: env('REDIS_HOST', 'localhost'),
    port: envInt('REDIS_PORT', 6379),
    password: envOptional('REDIS_PASSWORD'),
  },
  ai: {
    provider: (env('AI_PROVIDER', 'gemini') as 'gemini' | 'openai' | 'deepseek'),
    geminiApiKey: envOptional('GEMINI_API_KEY'),
    openaiApiKey: envOptional('OPENAI_API_KEY'),
    deepseekApiKey: envOptional('DEEPSEEK_API_KEY'),
    deepseekModel: env('DEEPSEEK_MODEL', 'deepseek-chat'),
  },
  telegram: {
    botToken: envOptional('TELEGRAM_BOT_TOKEN'),
    chatId: envOptional('TELEGRAM_CHAT_ID'),
  },
  email: {
    host: envOptional('SMTP_HOST'),
    port: envInt('SMTP_PORT', 587),
    user: envOptional('SMTP_USER'),
    pass: envOptional('SMTP_PASS'),
    from: envOptional('EMAIL_FROM'),
  },
  upload: {
    dir: env('UPLOAD_DIR', './uploads'),
    maxFileSize: 10 * 1024 * 1024, // 10MB
  },
}
