
export interface AvailableDates {
  oldest: string | null;
  newest: string | null;
}

export interface DbStatus {
  connected: boolean;
  checking: boolean;
  totalMatches: number;
  error: string | null;
}

export interface Trigger {
  trigger_name: string;
  success_rate: number;
  total_occurrences: number;
  successful_occurrences: number;
}

// Types for Deep Pattern Analysis
export interface GamePattern {
  date: string;
  time: string;
  opponent: string;
  is_home: boolean;
  score: string;
  total_goals: number;
  team_position: number;
  opponent_position: number;
  position_diff: number;
  is_over35: boolean;
  odds?: number | null;
  matchup_type: string;
}

export interface SimilarityAnalysis {
  total_over35_games: number;
  common_patterns: Record<string, any>;
  odds_analysis: Record<string, any>;
  position_analysis: Record<string, any>;
  matchup_analysis: Record<string, any>;
  summary: string;
}

export interface CorrelationAnalysis {
  position_diff_correlation: number;
  home_away_impact: Record<string, number>;
  opponent_strength_impact: Record<string, any>;
  summary: string;
}

export interface DeepPatternResponse {
  team_name: string;
  period: string;
  over35_rate: number;
  total_games: number;
  over35_games: number;
  all_games: GamePattern[];
  over35_only_games: GamePattern[];
  similarity_analysis: SimilarityAnalysis;
  correlation_analysis: CorrelationAnalysis;
  insights: string[];
  recommendations: string[];
}

export interface TeamDayPrediction {
    predicted_team: string;
    confidence: number;
    reasoning: string[];
    features_importance: Record<string, number>;
}

export interface PredictionResponse {
    historical_patterns: {
        date: string;
        team: string;
        over35_rate: number;
        features: Record<string, any>;
    }[];
    prediction: TeamDayPrediction;
    prediction_for_date: string;
}

// Types for Line Analysis
export interface LineDailyStat {
    line: number;
    total_games: number;
    over_35_count: number;
    over_35_rate: number;
}

export interface LineRepetitionStat {
    line: number;
    repetition_probability: number;
}

export interface LineAnalysisResponse {
    analysed_date: string;
    next_day_date: string;
    daily_stats: LineDailyStat[];
    repetition_stats: LineRepetitionStat[];
}

// Types for Odds Analysis
export interface OddAnalysisResult {
    odds_value: number;
    total_games: number;
    over_35_games: number;
    success_rate: number;
}

export interface OddsAnalysisResponse {
    hot_zone: OddAnalysisResult[];
    cold_zone: OddAnalysisResult[];
    full_distribution: OddAnalysisResult[];
}

// Types for Rare Score Analysis
export interface RareScoreStat {
    score_type: string;
    occurrences: number;
    average_interval: number | null;
    std_dev_interval: number | null;
    last_occurrence_date: string | null;
}

export interface RareScoreAnalysisResponse {
    stats: RareScoreStat[];
}


export type TabKey =
  | 'trigger'
  | 'deep-pattern'
  | 'line-analysis'
  | 'odds-analysis'
  | 'rare-score-analysis'
  | 'sequential'
  | 'predictive'
  | 'pattern-discovery'
  | 'efficient-pattern'
  | 'adaptive-learning'
  | 'over35-complete';
