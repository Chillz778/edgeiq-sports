import type { Analysis, Fixture } from './types'
import { demoAnalysis, demoFixtures } from './demo'

const apiBase = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')
const analysisRequests = new Map<number, Promise<Analysis>>()
let fixturesRequest: Promise<{ fixtures: Fixture[]; demo: boolean; warning?: string }> | null = null

async function request<T>(url: string): Promise<T> {
  const response = await fetch(`${apiBase}${url}`)
  if (!response.ok) throw new Error(`Request failed (${response.status})`)
  return response.json() as Promise<T>
}
export function getFixtures(q = '') {
  if (!q && fixturesRequest) return fixturesRequest
  const pending = (async () => {
    try { return await request<{ fixtures: Fixture[]; demo: boolean }>(`/api/fixtures${q ? `?q=${encodeURIComponent(q)}` : ''}`) }
    catch {
    const query = q.toLowerCase().trim()
    const fixtures = demoFixtures.filter(f => !query || `${f.home} ${f.away} ${f.league} ${f.country}`.toLowerCase().includes(query))
    return { fixtures, demo: true, warning: 'Live football data is unavailable. Showing clearly labeled demo fixtures instead.' }
    }
  })()
  if (!q) fixturesRequest = pending
  return pending
}
export async function getAnalysis(id: number) {
  const existing = analysisRequests.get(id)
  if (existing) return existing
  const pending = request<Analysis>(`/api/fixtures/${id}/analysis`).catch(() => {
    const fixture = demoFixtures.find(f => f.id === id)
    if (!fixture) throw new Error('Live analysis is temporarily unavailable')
    return demoAnalysis(fixture)
  })
  analysisRequests.set(id, pending)
  try { return await pending }
  catch (error) {
    analysisRequests.delete(id)
    throw error
  }
}
