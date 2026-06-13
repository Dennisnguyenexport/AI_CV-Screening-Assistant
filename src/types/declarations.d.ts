declare module 'pdf-parse-debugging-disabled' {
  interface PDFData {
    text: string
    numpages: number
    numrender: number
    info: Record<string, unknown>
    metadata: Record<string, unknown>
    version: string
  }
  function pdfParse(dataBuffer: Buffer, options?: Record<string, unknown>): Promise<PDFData>
  export default pdfParse
}

declare module 'mammoth' {
  interface ExtractedText {
    value: string
    messages: string[]
  }
  export function extractRawText(options: { path: string }): Promise<ExtractedText>
}

declare module 'nodemailer' {
  function createTransport(options: Record<string, unknown>): {
    sendMail(mail: Record<string, unknown>): Promise<unknown>
  }
  export { createTransport }
}
