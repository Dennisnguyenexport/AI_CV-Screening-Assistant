import { createClient } from '@supabase/supabase-js'
import { config } from '../config/index.js'

export const supabase = createClient(config.supabase.url, config.supabase.anonKey, {
  auth: { persistSession: false },
})

// Helper types
export type DbResult<T> = T extends PromiseLike<infer U> ? U : never
export type DbRow<T> = T extends Array<infer U> ? U : T
