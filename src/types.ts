export type Fixture = {
  id: number; home: string; away: string; home_code: string; away_code: string
  league: string; country: string; kickoff: string; venue?: string; status: string
  source: string; demo: boolean; stats: Record<string, number | null>
}
export type Prediction = {
  market: string; outcome: string; probability: number; confidence: string; note: string
}
export type Analysis = {
  fixture: Fixture; predictions: Prediction[]; summary: string[]
  data_quality: string; model_version: string; generated_at: string
}
