import type {
  DeepPatternResponse,
  PredictionResponse,
  Trigger,
  LineAnalysisResponse,
  OddsAnalysisResponse,
  RareScoreAnalysisResponse
} from '../types';

const API_BASE_URL = 'http://localhost:8000';

const handleResponse = async <T,>(response: Response): Promise<T> => {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: 'Erro desconhecido' }));
    throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
  }
  return response.json();
};

export const checkDatabaseStatus = () => {
  return fetch(`${API_BASE_URL}/analysis/health`).then(res => handleResponse<{ total_matches: number }>(res));
};

export const loadMarkets = () => {
  return fetch(`${API_BASE_URL}/analysis/markets`).then(res => handleResponse<{ markets: string[] }>(res));
};

export const loadTeams = () => {
  return fetch(`${API_BASE_URL}/analysis/teams`).then(res => handleResponse<{ teams: string[] }>(res));
};

export const loadAvailableDates = () => {
  return fetch(`${API_BASE_URL}/analysis/dates`).then(res => handleResponse<{ oldest_date: string; newest_date: string }>(res));
};

export const fetchTriggerAnalysis = (market: string, referenceDate: string, lookbackDays: number) => {
  return fetch(`${API_BASE_URL}/analysis/trigger-analysis`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      market: market,
      reference_date: referenceDate,
      lookback_days: lookbackDays,
    }),
  }).then(res => handleResponse<Trigger[]>(res));
};

export const analyzeTeamDeepPatterns = (teamName: string, startDate: string, endDate: string) => {
  return fetch(`${API_BASE_URL}/deep-pattern/analyze-team`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      team_name: teamName,
      start_date: startDate,
      end_date: endDate
    })
  }).then(res => handleResponse<DeepPatternResponse>(res));
};

// ✅ Corrigido: usa query string, sem body
export const predictTeamOfDay = (startDate: string, endDate: string) => {
  const url = new URL(`${API_BASE_URL}/deep-pattern/predict-team-of-day`);
  url.searchParams.append('start_date', startDate);
  url.searchParams.append('end_date', endDate);

  // Não envia body, então não precisa de Content-Type: application/json
  return fetch(url.toString(), {
    method: 'POST',
    // headers omitidos ou sem Content-Type, pois não há corpo
  }).then(res => handleResponse<PredictionResponse>(res));
};

export const analyzeLinesByDay = (date: string) => {
  return fetch(`${API_BASE_URL}/line-analysis/analyze-by-day?date=${date}`).then(res => handleResponse<LineAnalysisResponse>(res));
};

export const analyzeOddsDistribution = () => {
  return fetch(`${API_BASE_URL}/odds-analysis/distribution`).then(res => handleResponse<OddsAnalysisResponse>(res));
};

export const analyzeRareScores = () => {
  return fetch(`${API_BASE_URL}/rare-score-analysis/analyze`).then(res => handleResponse<RareScoreAnalysisResponse>(res));
};