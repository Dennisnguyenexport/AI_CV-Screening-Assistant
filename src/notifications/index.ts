import { config } from '../config/index.js'
import { supabase } from '../database/client.js'
import { createNotification, updateNotificationStatus } from '../database/repository.js'
import type { Notification, NotificationChannel, ScreeningResult } from '../types/index.js'

interface NotifyParams {
  application_id: string
  candidate_name: string
  candidate_email: string
  job_title: string
  screening: ScreeningResult
}

/**
 * Build notification message for screening result
 */
function buildScreeningMessage(params: NotifyParams): { subject: string; body: string } {
  const { candidate_name, job_title, screening } = params

  const statusEmoji: Record<string, string> = {
    interview: '✅',
    shortlist: '⭐',
    review: '👀',
    reject: '❌',
  }

  const statusText: Record<string, string> = {
    interview: 'Nên phỏng vấn',
    shortlist: 'Triển vọng',
    review: 'Cần xem xét',
    reject: 'Không phù hợp',
  }

  const subject = `[CV Screening] ${candidate_name} - ${job_title}`
  const emoji = statusEmoji[screening.recommendation] || '📄'

  const body = [
    `${emoji} **Kết quả sàng lọc CV**`,
    ``,
    `**Ứng viên:** ${candidate_name}`,
    `**Email:** ${params.candidate_email}`,
    `**Vị trí:** ${job_title}`,
    ``,
    `**Đánh giá:** ${statusText[screening.recommendation]}`,
    `**Điểm số:** ${screening.score}/100`,
    ``,
    `**Tóm tắt:**`,
    screening.summary,
    ``,
    screening.strengths.length > 0
      ? `**Điểm mạnh:**\n${screening.strengths.map(s => `  ✅ ${s}`).join('\n')}`
      : '',
    screening.weaknesses.length > 0
      ? `\n**Điểm yếu:**\n${screening.weaknesses.map(w => `  ⚠️ ${w}`).join('\n')}`
      : '',
    screening.risks.length > 0
      ? `\n**Rủi ro cần xác minh:**\n${screening.risks.map(r => `  🔍 ${r}`).join('\n')}`
      : '',
  ]
    .filter(Boolean)
    .join('\n')

  return { subject, body }
}

/**
 * Send Telegram notification
 */
async function sendTelegram(chatId: string, message: string): Promise<boolean> {
  if (!config.telegram.botToken) {
    console.warn('⚠️  TELEGRAM_BOT_TOKEN not configured, skipping Telegram notification')
    return false
  }

  try {
    const { Telegraf } = await import('telegraf')
    const bot = new Telegraf(config.telegram.botToken)
    await bot.telegram.sendMessage(chatId, message, { parse_mode: 'Markdown' })
    return true
  } catch (err) {
    console.error('❌ Telegram send failed:', err)
    return false
  }
}

/**
 * Send Email notification (placeholder - requires SMTP config)
 */
async function sendEmail(to: string, subject: string, body: string): Promise<boolean> {
  if (!config.email.host || !config.email.user) {
    console.warn('⚠️  SMTP not configured, skipping Email notification')
    return false
  }

  try {
    const { createTransport } = await import('nodemailer')
    const transporter = createTransport({
      host: config.email.host,
      port: config.email.port,
      secure: config.email.port === 465,
      auth: {
        user: config.email.user,
        pass: config.email.pass,
      },
    })

    await transporter.sendMail({
      from: config.email.from || config.email.user,
      to,
      subject,
      text: body,
    })
    return true
  } catch (err) {
    console.error('❌ Email send failed:', err)
    return false
  }
}

/**
 * Send notification via specified channel
 */
export async function sendNotification(params: NotifyParams, channel: NotificationChannel): Promise<void> {
  const { subject, body } = buildScreeningMessage(params)

  // Determine recipient
  let toAddress = params.candidate_email
  if (channel === 'telegram') {
    toAddress = config.telegram.chatId || params.candidate_email
  }

  // Record notification in DB
  const notification = await createNotification({
    application_id: params.application_id,
    channel,
    to_address: toAddress,
    subject: channel === 'email' ? subject : undefined,
    body,
  })

  // Send
  let success = false
  if (channel === 'telegram') {
    success = await sendTelegram(toAddress, body)
  } else if (channel === 'email') {
    success = await sendEmail(toAddress, subject, body)
  }

  // Update status
  await updateNotificationStatus(
    notification.id,
    success ? 'sent' : 'failed',
    success ? undefined : 'Failed to send',
  )
}

/**
 * Get notification channel preference from user/application
 */
export function getDefaultChannels(): NotificationChannel[] {
  const channels: NotificationChannel[] = []
  if (config.telegram.botToken) channels.push('telegram')
  if (config.email.host) channels.push('email')
  // Default to telegram if nothing configured
  if (channels.length === 0) channels.push('telegram')
  return channels
}
