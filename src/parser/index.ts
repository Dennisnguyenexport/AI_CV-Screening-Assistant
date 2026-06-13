import fs from 'node:fs/promises'
import path from 'node:path'
import { config } from '../config/index.js'

// PDF parser - dynamic import because native ESM
let pdfParse: typeof import('pdf-parse-debugging-disabled').default | null = null
async function getPdfParser() {
  if (!pdfParse) {
    pdfParse = (await import('pdf-parse-debugging-disabled')).default
  }
  return pdfParse
}

// DOCX parser
let mammoth: typeof import('mammoth') | null = null
async function getMammoth() {
  if (!mammoth) {
    mammoth = await import('mammoth')
  }
  return mammoth
}

export interface ParsedCV {
  raw_text: string
  file_type: 'pdf' | 'docx'
  file_name: string
  file_size: number
  pages?: number
}

/**
 * Parse CV file to extract raw text
 */
export async function parseCV(filePath: string): Promise<ParsedCV> {
  const ext = path.extname(filePath).toLowerCase()
  const stats = await fs.stat(filePath)
  const fileName = path.basename(filePath)

  if (ext === '.pdf') {
    return parsePDF(filePath, fileName, stats.size)
  } else if (ext === '.docx') {
    return parseDOCX(filePath, fileName, stats.size)
  } else {
    throw new Error(`Unsupported file type: ${ext}. Only PDF and DOCX are supported.`)
  }
}

async function parsePDF(filePath: string, fileName: string, fileSize: number): Promise<ParsedCV> {
  const parse = await getPdfParser()
  const fileBuffer = await fs.readFile(filePath)
  const data = await parse(fileBuffer)

  return {
    raw_text: data.text || '',
    file_type: 'pdf',
    file_name: fileName,
    file_size: fileSize,
    pages: data.numpages,
  }
}

async function parseDOCX(filePath: string, fileName: string, fileSize: number): Promise<ParsedCV> {
  const m = await getMammoth()
  const result = await m.extractRawText({ path: filePath })

  return {
    raw_text: result.value || '',
    file_type: 'docx',
    file_name: fileName,
    file_size: fileSize,
  }
}

// ===== Upload helpers =====

export async function saveUploadedFile(
  buffer: Buffer,
  fileName: string,
  candidateId: string,
): Promise<string> {
  const uploadDir = path.resolve(config.upload.dir, candidateId)
  await fs.mkdir(uploadDir, { recursive: true })

  const safeName = `${Date.now()}-${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`
  const filePath = path.join(uploadDir, safeName)
  await fs.writeFile(filePath, buffer)

  return filePath
}

export async function cleanupUpload(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath)
  } catch {
    // File might already be cleaned up
  }
}
