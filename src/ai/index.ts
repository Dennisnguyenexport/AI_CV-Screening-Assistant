import { config } from '../config/index.js'
import type { ScreeningResult } from '../types/index.js'

export interface AIScreeningInput {
  cvRawText: string
  jobTitle: string
  jobDescription: string
  jobRequirements?: string
}

export interface AIScreeningOutput {
  recommendation: ScreeningResult['recommendation']
  score: number
  summary: string
  strengths: string[]
  weaknesses: string[]
  risks: string[]
  skills_match: Record<string, number>
  raw_output: string
}

const SYSTEM_PROMPT = `Bạn là chuyên viên tuyển dụng AI. Nhiệm vụ của bạn là phân tích CV ứng viên và đưa ra đánh giá dựa trên mô tả công việc (JD).

Hãy phân tích CV và trả về JSON hợp lệ với cấu trúc sau (KHÔNG thêm markdown, KHÔNG thêm giải thích, CHỈ trả về JSON):

{
  "recommendation": "interview" | "shortlist" | "review" | "reject",
  "score": <0-100>,
  "summary": "<tóm tắt ngắn gọn bằng tiếng Việt>",
  "strengths": ["<điểm mạnh 1>", "<điểm mạnh 2>"],
  "weaknesses": ["<điểm yếu 1>", "<điểm yếu 2>"],
  "risks": ["<rủi ro cần xác minh 1>"],
  "skills_match": { "<tên kỹ năng>": <độ tin cậy 0-100> }
}

Quy tắc đánh giá:
- interview (80-100): Đáp ứng tốt yêu cầu, kinh nghiệm phù hợp, nên phỏng vấn
- shortlist (60-79): Đáp ứng phần lớn yêu cầu, có thể phỏng vấn
- review (40-59): Còn thiếu một số yêu cầu, cần xem xét thêm
- reject (0-39): Không phù hợp với yêu cầu công việc

Phân tích bằng tiếng Việt cho summary, strengths, weaknesses, risks.`

function buildPrompt(input: AIScreeningInput): string {
  return `## MÔ TẢ CÔNG VIỆC
Vị trí: ${input.jobTitle}
Mô tả: ${input.jobDescription}
Yêu cầu: ${input.jobRequirements || 'Không có'}

## NỘI DUNG CV
${input.cvRawText}

---

Phân tích CV ứng viên này và đưa ra đánh giá.`
}

/**
 * AI Screening Engine - Gemini
 */
async function screeningWithGemini(input: AIScreeningInput): Promise<AIScreeningOutput> {
  const { GoogleGenerativeAI } = await import('@google/generative-ai')
  const genAI = new GoogleGenerativeAI(config.ai.geminiApiKey!)
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

  const startTime = Date.now()

  const result = await model.generateContent({
    systemInstruction: { role: 'system', parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{ role: 'user', parts: [{ text: buildPrompt(input) }] }],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 2048,
    },
  })

  const elapsed = Date.now() - startTime
  const text = result.response.text()

  return parseAIResponse(text, elapsed)
}

/**
 * AI Screening Engine - OpenAI
 */
async function screeningWithOpenAI(input: AIScreeningInput): Promise<AIScreeningOutput> {
  const OpenAI = (await import('openai')).default
  const openai = new OpenAI({ apiKey: config.ai.openaiApiKey })

  const startTime = Date.now()

  const completion = await openai.chat.completions.create({
    model: config.ai.openaiApiKey ? 'gpt-4o-mini' : 'deepseek-chat',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildPrompt(input) },
    ],
    temperature: 0.3,
    max_tokens: 2048,
  })

  const elapsed = Date.now() - startTime
  const text = completion.choices[0]?.message?.content || ''

  return parseAIResponse(text, elapsed)
}

/**
 * AI Screening Engine - DeepSeek
 * Uses OpenAI-compatible SDK with DeepSeek base URL
 */
async function screeningWithDeepSeek(input: AIScreeningInput): Promise<AIScreeningOutput> {
  const OpenAI = (await import('openai')).default
  const client = new OpenAI({
    apiKey: config.ai.deepseekApiKey,
    baseURL: 'https://api.deepseek.com',
  })

  const startTime = Date.now()

  const completion = await client.chat.completions.create({
    model: config.ai.deepseekModel || 'deepseek-chat',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildPrompt(input) },
    ],
    temperature: 0.3,
    max_tokens: 2048,
  })

  const elapsed = Date.now() - startTime
  const text = completion.choices[0]?.message?.content || ''

  return parseAIResponse(text, elapsed)
}

/**
 * Parse AI JSON response, handling markdown wrapping
 */
function parseAIResponse(text: string, processingTimeMs: number): AIScreeningOutput {
  // Strip markdown code block if present
  const cleaned = text
    .replace(/^```(?:json)?\s*/gm, '')
    .replace(/\s*```$/gm, '')
    .trim()

  let parsed: Record<string, unknown>

  try {
    parsed = JSON.parse(cleaned)
  } catch {
    // Fallback: try to extract JSON from the response
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[0])
    } else {
      throw new Error(`Failed to parse AI response as JSON:\n${text.substring(0, 500)}`)
    }
  }

  return {
    recommendation: validateRecommendation(parsed.recommendation),
    score: Math.max(0, Math.min(100, Number(parsed.score) || 0)),
    summary: String(parsed.summary || ''),
    strengths: asStringArray(parsed.strengths),
    weaknesses: asStringArray(parsed.weaknesses),
    risks: asStringArray(parsed.risks),
    skills_match: asRecord(parsed.skills_match),
    raw_output: text,
  }
}

function validateRecommendation(val: unknown): ScreeningResult['recommendation'] {
  const valid = ['interview', 'shortlist', 'review', 'reject']
  const str = String(val).toLowerCase()
  return valid.includes(str) ? str as ScreeningResult['recommendation'] : 'review'
}

function asStringArray(val: unknown): string[] {
  if (Array.isArray(val)) return val.map(String)
  if (typeof val === 'string') return [val]
  return []
}

function asRecord(val: unknown): Record<string, number> {
  if (val && typeof val === 'object' && !Array.isArray(val)) {
    const result: Record<string, number> = {}
    for (const [k, v] of Object.entries(val)) {
      result[k] = Number(v) || 0
    }
    return result
  }
  return {}
}

/**
 * Main screening function - auto-selects provider
 */
export async function screenCV(input: AIScreeningInput): Promise<AIScreeningOutput> {
  if (config.ai.provider === 'openai') {
    if (!config.ai.openaiApiKey) throw new Error('OPENAI_API_KEY is required')
    return screeningWithOpenAI(input)
  }

  if (config.ai.provider === 'deepseek') {
    if (!config.ai.deepseekApiKey) throw new Error('DEEPSEEK_API_KEY is required')
    return screeningWithDeepSeek(input)
  }

  // Default: Gemini
  if (!config.ai.geminiApiKey) throw new Error('GEMINI_API_KEY is required')
  return screeningWithGemini(input)
}
