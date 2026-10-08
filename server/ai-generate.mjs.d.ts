export function generateAiText(args: {
  task: string
  payload: Record<string, unknown>
  apiKey?: string
  model?: string
}): Promise<string>

export function verifySupabaseUser(args: {
  authHeader?: string
  supabaseUrl?: string
  supabaseAnonKey?: string
}): Promise<{ ok: boolean; status?: number; error?: string; user?: unknown }>

export function parseAiRequestBody(body: unknown): {
  task: string
  property?: unknown
  lead?: unknown
  agentName?: string
}
