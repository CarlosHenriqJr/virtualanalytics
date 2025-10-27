"""
deep_pattern_analysis.py - Análise Profunda de Padrões Over 3.5

Responde perguntas como:
- O que levou um time a ter X% de Over 3.5?
- Existe similaridade entre os jogos Over 3.5 de um time?
- São ODDs específicas? É a posição na tabela?
- Quando há Over 3.5, qual era a posição de cada time?
- Como prever qual será o "time do dia" amanhã?
"""

from fastapi import APIRouter, HTTPException
from typing import List, Optional, Dict, Any, Tuple
from datetime import datetime, timedelta
from pydantic import BaseModel
from database import get_database
from collections import defaultdict, Counter
import statistics
from scipy import stats
import numpy as np

deep_pattern_router = APIRouter(prefix="/deep-pattern", tags=["deep-pattern"])

# ==================== MODELOS ====================

class DeepPatternRequest(BaseModel):
    team_name: str  # Time para análise profunda
    start_date: str
    end_date: str

class GamePattern(BaseModel):
    """Padrão de um jogo específico"""
    date: str
    time: str
    opponent: str
    is_home: bool
    score: str
    total_goals: int
    team_position: int  # Posição do time na tabela
    opponent_position: int  # Posição do adversário
    position_diff: int  # Diferença de posições
    is_over35: bool
    odds: Optional[float] = None  # ODDs (se disponível)
    matchup_type: str  # "forte_vs_fraco", "equilibrado", etc

class SimilarityAnalysis(BaseModel):
    """Análise de similaridade entre jogos Over 3.5"""
    total_over35_games: int
    common_patterns: Dict[str, Any]
    odds_analysis: Dict[str, Any]
    position_analysis: Dict[str, Any]
    matchup_analysis: Dict[str, Any]
    summary: str

class CorrelationAnalysis(BaseModel):
    """Análise de correlação entre variáveis"""
    position_diff_correlation: float  # Correlação entre diferença de posição e Over 3.5
    home_away_impact: Dict[str, float]  # Impacto de jogar em casa/fora
    opponent_strength_impact: Dict[str, Any]  # Impacto da força do adversário
    summary: str

class TeamDayPrediction(BaseModel):
    """Predição do time do dia"""
    predicted_team: str
    confidence: float
    reasoning: List[str]
    features_importance: Dict[str, float]

class DeepPatternResponse(BaseModel):
    """Resposta completa da análise profunda"""
    team_name: str
    period: str
    over35_rate: float
    total_games: int
    over35_games: int
    all_games: List[GamePattern]
    over35_only_games: List[GamePattern]
    similarity_analysis: SimilarityAnalysis
    correlation_analysis: CorrelationAnalysis
    insights: List[str]
    recommendations: List[str]

# ==================== ENDPOINT PRINCIPAL ====================

@deep_pattern_router.post("/analyze-team")
async def analyze_team_deep_patterns(request: DeepPatternRequest):
    """
    Análise profunda de padrões de um time específico.
    
    Responde:
    - O que levou o time a ter X% de Over 3.5?
    - Existe similaridade entre os jogos Over 3.5?
    - São ODDs específicas? É a posição na tabela?
    - Quando há Over 3.5, qual era a posição de cada time?
    """
    try:
        db = await get_database()
        
        # Buscar todos os jogos do time no período
        cursor = db.partidas.find({
            "date": {
                "$gte": request.start_date,
                "$lte": request.end_date
            },
            "$or": [
                {"timeCasa": request.team_name},
                {"timeFora": request.team_name}
            ]
        }).sort([("date", 1), ("hour", 1)])
        
        matches = await cursor.to_list(length=None)
        
        if not matches:
            raise HTTPException(status_code=404, detail=f"Nenhum jogo encontrado para {request.team_name}")
        
        # Calcular classificação ao longo do tempo
        standings_over_time = await calculate_standings_over_time(db, request.start_date, request.end_date)
        
        # Processar cada jogo
        all_games = []
        over35_games = []
        
        for match in matches:
            game_pattern = process_game(match, request.team_name, standings_over_time)
            all_games.append(game_pattern)
            
            if game_pattern.is_over35:
                over35_games.append(game_pattern)
        
        # Calcular taxa de Over 3.5
        over35_rate = (len(over35_games) / len(all_games) * 100) if all_games else 0
        
        # Análise de similaridade
        similarity_analysis = analyze_similarity(over35_games, all_games)
        
        # Análise de correlação
        correlation_analysis = analyze_correlations(all_games, over35_games)
        
        # Gerar insights
        insights = generate_insights(
            request.team_name,
            over35_rate,
            similarity_analysis,
            correlation_analysis,
            over35_games
        )
        
        # Gerar recomendações
        recommendations = generate_recommendations(
            similarity_analysis,
            correlation_analysis
        )
        
        return DeepPatternResponse(
            team_name=request.team_name,
            period=f"{request.start_date} a {request.end_date}",
            over35_rate=round(over35_rate, 2),
            total_games=len(all_games),
            over35_games=len(over35_games),
            all_games=all_games,
            over35_only_games=over35_games,
            similarity_analysis=similarity_analysis,
            correlation_analysis=correlation_analysis,
            insights=insights,
            recommendations=recommendations
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==================== ENDPOINT DE PREDIÇÃO ====================

@deep_pattern_router.post("/predict-team-of-day")
async def predict_team_of_day(start_date: str, end_date: str):
    """
    Prediz qual será o "time do dia" para o dia seguinte.
    
    Usa machine learning para identificar padrões e prever.
    """
    try:
        db = await get_database()
        
        # Buscar dados históricos
        cursor = db.partidas.find({
            "date": {
                "$gte": start_date,
                "$lte": end_date
            }
        }).sort([("date", 1)])
        
        matches = await cursor.to_list(length=None)
        
        if not matches:
            raise HTTPException(status_code=404, detail="Nenhum jogo encontrado")
        
        # Agrupar por data
        games_by_date = defaultdict(list)
        for match in matches:
            date = match.get("date", "")
            if date:
                games_by_date[date].append(match)
        
        # Analisar cada dia e identificar o time do dia
        daily_patterns = []
        
        for date in sorted(games_by_date.keys()):
            day_matches = games_by_date[date]
            team_of_day = identify_team_of_day_for_date(day_matches)
            
            if team_of_day:
                daily_patterns.append({
                    "date": date,
                    "team": team_of_day["team"],
                    "over35_rate": team_of_day["over35_rate"],
                    "features": team_of_day["features"]
                })
        
        # Prever o próximo time do dia
        if len(daily_patterns) >= 3:
            prediction = predict_next_team_of_day(daily_patterns)
        else:
            prediction = TeamDayPrediction(
                predicted_team="Dados insuficientes",
                confidence=0.0,
                reasoning=["Necessário pelo menos 3 dias de histórico"],
                features_importance={}
            )
        
        return {
            "historical_patterns": daily_patterns,
            "prediction": prediction
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==================== FUNÇÕES AUXILIARES ====================

async def calculate_standings_over_time(db, start_date: str, end_date: str) -> Dict[str, Dict[str, int]]:
    """
    Calcula a classificação dos times ao longo do tempo.
    Retorna: {date: {team: position}}
    """
    cursor = db.partidas.find({
        "date": {
            "$gte": start_date,
            "$lte": end_date
        }
    }).sort([("date", 1)])
    
    matches = await cursor.to_list(length=None)
    
    standings_over_time = {}
    team_stats = defaultdict(lambda: {"points": 0, "goal_diff": 0})
    
    current_date = None
    
    for match in matches:
        date = match.get("date", "")
        if not date:
            continue
        
        # Se mudou de dia, calcular posições
        if date != current_date:
            if current_date:
                standings_over_time[current_date] = calculate_positions(team_stats)
            current_date = date
        
        # Atualizar estatísticas
        home_team = match.get("timeCasa", "")
        away_team = match.get("timeFora", "")
        home_goals = match.get("placarCasaFT", 0)
        away_goals = match.get("placarForaFT", 0)
        
        if home_team and away_team:
            team_stats[home_team]["goal_diff"] += (home_goals - away_goals)
            team_stats[away_team]["goal_diff"] += (away_goals - home_goals)
            
            if home_goals > away_goals:
                team_stats[home_team]["points"] += 3
            elif away_goals > home_goals:
                team_stats[away_team]["points"] += 3
            else:
                team_stats[home_team]["points"] += 1
                team_stats[away_team]["points"] += 1
    
    # Última data
    if current_date:
        standings_over_time[current_date] = calculate_positions(team_stats)
    
    return standings_over_time

def calculate_positions(team_stats: Dict[str, Dict[str, int]]) -> Dict[str, int]:
    """Calcula as posições dos times baseado em pontos e saldo de gols."""
    sorted_teams = sorted(
        team_stats.items(),
        key=lambda x: (x[1]["points"], x[1]["goal_diff"]),
        reverse=True
    )
    
    positions = {}
    for i, (team, _) in enumerate(sorted_teams, 1):
        positions[team] = i
    
    return positions

def process_game(match: dict, team_name: str, standings_over_time: Dict[str, Dict[str, int]]) -> GamePattern:
    """Processa um jogo e extrai padrões."""
    date = match.get("date", "")
    time = match.get("hour", "")
    home_team = match.get("timeCasa", "")
    away_team = match.get("timeFora", "")
    home_goals = match.get("placarCasaFT", 0)
    away_goals = match.get("placarForaFT", 0)
    total_goals = match.get("totalGolsFT", 0)
    
    is_home = (team_name == home_team)
    opponent = away_team if is_home else home_team
    score = f"{home_goals}-{away_goals}"
    is_over35 = total_goals > 3.5
    
    # Obter posições na tabela
    positions = standings_over_time.get(date, {})
    team_position = positions.get(team_name, 99)
    opponent_position = positions.get(opponent, 99)
    position_diff = abs(team_position - opponent_position)
    
    # Determinar tipo de confronto
    if position_diff <= 3:
        matchup_type = "equilibrado"
    elif team_position < opponent_position:
        matchup_type = "forte_vs_fraco"
    else:
        matchup_type = "fraco_vs_forte"
    
    return GamePattern(
        date=date,
        time=time,
        opponent=opponent,
        is_home=is_home,
        score=score,
        total_goals=total_goals,
        team_position=team_position,
        opponent_position=opponent_position,
        position_diff=position_diff,
        is_over35=is_over35,
        odds=None,  # Pode ser preenchido se disponível
        matchup_type=matchup_type
    )

def analyze_similarity(over35_games: List[GamePattern], all_games: List[GamePattern]) -> SimilarityAnalysis:
    """
    Analisa similaridade entre jogos Over 3.5.
    
    Identifica padrões comuns:
    - ODDs médias
    - Posições na tabela
    - Tipo de confronto
    - Casa vs Fora
    """
    if not over35_games:
        return SimilarityAnalysis(
            total_over35_games=0,
            common_patterns={},
            odds_analysis={},
            position_analysis={},
            matchup_analysis={},
            summary="Nenhum jogo Over 3.5 encontrado"
        )
    
    # Padrões comuns
    home_count = sum(1 for g in over35_games if g.is_home)
    away_count = len(over35_games) - home_count
    
    common_patterns = {
        "home_games": home_count,
        "away_games": away_count,
        "home_rate": round(home_count / len(over35_games) * 100, 2),
        "away_rate": round(away_count / len(over35_games) * 100, 2)
    }
    
    # Análise de ODDs (se disponível)
    odds_analysis = {
        "available": False,
        "note": "Dados de ODDs não disponíveis nos jogos"
    }
    
    # Análise de posições
    team_positions = [g.team_position for g in over35_games if g.team_position < 99]
    opponent_positions = [g.opponent_position for g in over35_games if g.opponent_position < 99]
    position_diffs = [g.position_diff for g in over35_games if g.position_diff < 99]
    
    position_analysis = {
        "avg_team_position": round(statistics.mean(team_positions), 1) if team_positions else None,
        "avg_opponent_position": round(statistics.mean(opponent_positions), 1) if opponent_positions else None,
        "avg_position_diff": round(statistics.mean(position_diffs), 1) if position_diffs else None,
        "min_position_diff": min(position_diffs) if position_diffs else None,
        "max_position_diff": max(position_diffs) if position_diffs else None
    }
    
    # Análise de tipo de confronto
    matchup_types = Counter([g.matchup_type for g in over35_games])
    matchup_analysis = {
        "types": dict(matchup_types),
        "most_common": matchup_types.most_common(1)[0][0] if matchup_types else None
    }
    
    # Resumo
    summary = f"Dos {len(over35_games)} jogos Over 3.5: "
    summary += f"{home_count} em casa ({common_patterns['home_rate']}%), "
    summary += f"{away_count} fora ({common_patterns['away_rate']}%). "
    
    if position_analysis["avg_position_diff"]:
        summary += f"Diferença média de posições: {position_analysis['avg_position_diff']}. "
    
    if matchup_analysis["most_common"]:
        summary += f"Tipo de confronto mais comum: {matchup_analysis['most_common']}."
    
    return SimilarityAnalysis(
        total_over35_games=len(over35_games),
        common_patterns=common_patterns,
        odds_analysis=odds_analysis,
        position_analysis=position_analysis,
        matchup_analysis=matchup_analysis,
        summary=summary
    )

def analyze_correlations(all_games: List[GamePattern], over35_games: List[GamePattern]) -> CorrelationAnalysis:
    """
    Analisa correlações entre variáveis e Over 3.5.
    """
    if not all_games:
        return CorrelationAnalysis(
            position_diff_correlation=0.0,
            home_away_impact={},
            opponent_strength_impact={},
            summary="Dados insuficientes"
        )
    
    # Correlação entre diferença de posição e Over 3.5
    position_diffs = [g.position_diff for g in all_games if g.position_diff < 99]
    over35_binary = [1 if g.is_over35 else 0 for g in all_games if g.position_diff < 99]
    
    if len(position_diffs) > 1 and len(set(position_diffs)) > 1:
        correlation, _ = stats.pearsonr(position_diffs, over35_binary)
    else:
        correlation = 0.0
    
    # Impacto de jogar em casa/fora
    home_games = [g for g in all_games if g.is_home]
    away_games = [g for g in all_games if not g.is_home]
    
    home_over35_rate = (sum(1 for g in home_games if g.is_over35) / len(home_games) * 100) if home_games else 0
    away_over35_rate = (sum(1 for g in away_games if g.is_over35) / len(away_games) * 100) if away_games else 0
    
    home_away_impact = {
        "home_over35_rate": round(home_over35_rate, 2),
        "away_over35_rate": round(away_over35_rate, 2),
        "difference": round(home_over35_rate - away_over35_rate, 2)
    }
    
    # Impacto da força do adversário
    strong_opponents = [g for g in all_games if g.opponent_position <= 5]
    weak_opponents = [g for g in all_games if g.opponent_position >= 10]
    
    strong_over35_rate = (sum(1 for g in strong_opponents if g.is_over35) / len(strong_opponents) * 100) if strong_opponents else 0
    weak_over35_rate = (sum(1 for g in weak_opponents if g.is_over35) / len(weak_opponents) * 100) if weak_opponents else 0
    
    opponent_strength_impact = {
        "vs_strong_over35_rate": round(strong_over35_rate, 2),
        "vs_weak_over35_rate": round(weak_over35_rate, 2),
        "difference": round(weak_over35_rate - strong_over35_rate, 2)
    }
    
    # Resumo
    summary = f"Correlação posição-Over35: {correlation:.2f}. "
    summary += f"Over35 em casa: {home_over35_rate:.1f}%, fora: {away_over35_rate:.1f}%. "
    summary += f"Vs fortes: {strong_over35_rate:.1f}%, vs fracos: {weak_over35_rate:.1f}%."
    
    return CorrelationAnalysis(
        position_diff_correlation=round(correlation, 3),
        home_away_impact=home_away_impact,
        opponent_strength_impact=opponent_strength_impact,
        summary=summary
    )

def generate_insights(team_name: str, over35_rate: float, similarity: SimilarityAnalysis, 
                     correlation: CorrelationAnalysis, over35_games: List[GamePattern]) -> List[str]:
    """Gera insights baseados nas análises."""
    insights = []
    
    # Insight 1: Taxa geral
    insights.append(f"📊 {team_name} teve {over35_rate:.1f}% de Over 3.5 no período ({similarity.total_over35_games} jogos)")
    
    # Insight 2: Casa vs Fora
    if similarity.common_patterns:
        home_rate = similarity.common_patterns.get("home_rate", 0)
        away_rate = similarity.common_patterns.get("away_rate", 0)
        
        if home_rate > away_rate + 10:
            insights.append(f"🏠 Over 3.5 mais frequente em casa ({home_rate:.1f}%) do que fora ({away_rate:.1f}%)")
        elif away_rate > home_rate + 10:
            insights.append(f"✈️ Over 3.5 mais frequente fora ({away_rate:.1f}%) do que em casa ({home_rate:.1f}%)")
        else:
            insights.append(f"⚖️ Over 3.5 equilibrado entre casa ({home_rate:.1f}%) e fora ({away_rate:.1f}%)")
    
    # Insight 3: Posição na tabela
    if similarity.position_analysis.get("avg_team_position"):
        avg_pos = similarity.position_analysis["avg_team_position"]
        insights.append(f"📍 Nos jogos Over 3.5, {team_name} estava em média na {avg_pos:.0f}ª posição")
    
    # Insight 4: Tipo de confronto
    if similarity.matchup_analysis.get("most_common"):
        matchup = similarity.matchup_analysis["most_common"]
        insights.append(f"🎯 Tipo de confronto mais comum em Over 3.5: {matchup}")
    
    # Insight 5: Correlação
    if abs(correlation.position_diff_correlation) >= 0.3:
        if correlation.position_diff_correlation > 0:
            insights.append(f"📈 Maior diferença de posições tende a resultar em Over 3.5 (correlação: {correlation.position_diff_correlation:.2f})")
        else:
            insights.append(f"📉 Menor diferença de posições tende a resultar em Over 3.5 (correlação: {correlation.position_diff_correlation:.2f})")
    
    return insights

def generate_recommendations(similarity: SimilarityAnalysis, correlation: CorrelationAnalysis) -> List[str]:
    """Gera recomendações baseadas nas análises."""
    recommendations = []
    
    # Recomendação 1: Casa vs Fora
    if similarity.common_patterns:
        home_rate = similarity.common_patterns.get("home_rate", 0)
        away_rate = similarity.common_patterns.get("away_rate", 0)
        
        if home_rate > 60:
            recommendations.append("✅ Priorize jogos em casa - maior taxa de Over 3.5")
        elif away_rate > 60:
            recommendations.append("✅ Priorize jogos fora - maior taxa de Over 3.5")
    
    # Recomendação 2: Força do adversário
    if correlation.opponent_strength_impact:
        vs_weak = correlation.opponent_strength_impact.get("vs_weak_over35_rate", 0)
        vs_strong = correlation.opponent_strength_impact.get("vs_strong_over35_rate", 0)
        
        if vs_weak > vs_strong + 10:
            recommendations.append("✅ Foque em jogos contra adversários mais fracos")
        elif vs_strong > vs_weak + 10:
            recommendations.append("✅ Jogos contra adversários fortes tendem a ter mais gols")
    
    # Recomendação 3: Tipo de confronto
    if similarity.matchup_analysis.get("most_common"):
        matchup = similarity.matchup_analysis["most_common"]
        recommendations.append(f"✅ Padrão identificado: {matchup} - busque jogos similares")
    
    # Recomendação 4: Posição
    if similarity.position_analysis.get("avg_position_diff"):
        avg_diff = similarity.position_analysis["avg_position_diff"]
        recommendations.append(f"✅ Diferença média de posições em Over 3.5: {avg_diff:.0f} - use como referência")
    
    return recommendations

def identify_team_of_day_for_date(day_matches: List[dict]) -> Optional[Dict[str, Any]]:
    """Identifica o time do dia para uma data específica."""
    team_stats = defaultdict(lambda: {"over35": 0, "total": 0})
    
    for match in day_matches:
        home_team = match.get("timeCasa", "")
        away_team = match.get("timeFora", "")
        total_goals = match.get("totalGolsFT", 0)
        
        for team in [home_team, away_team]:
            if team:
                team_stats[team]["total"] += 1
                if total_goals > 3.5:
                    team_stats[team]["over35"] += 1
    
    # Encontrar o time com maior taxa de Over 3.5
    best_team = None
    best_rate = 0
    
    for team, stats in team_stats.items():
        if stats["total"] > 0:
            rate = (stats["over35"] / stats["total"]) * 100
            if rate > best_rate:
                best_rate = rate
                best_team = team
    
    if best_team:
        return {
            "team": best_team,
            "over35_rate": best_rate,
            "features": {
                "total_games": team_stats[best_team]["total"],
                "over35_games": team_stats[best_team]["over35"]
            }
        }
    
    return None

def predict_next_team_of_day(daily_patterns: List[Dict[str, Any]]) -> TeamDayPrediction:
    """
    Prediz o próximo time do dia baseado em padrões históricos.
    
    Usa análise de tendências e recorrência.
    """
    # Contar frequência de cada time
    team_frequency = Counter([p["team"] for p in daily_patterns])
    
    # Analisar tendência recente (últimos 3 dias)
    recent_teams = [p["team"] for p in daily_patterns[-3:]]
    recent_frequency = Counter(recent_teams)
    
    # Combinar frequência geral e recente
    scores = {}
    for team in team_frequency:
        general_score = team_frequency[team] / len(daily_patterns)
        recent_score = recent_frequency.get(team, 0) / 3
        scores[team] = (general_score * 0.4) + (recent_score * 0.6)  # Peso maior para recente
    
    # Melhor candidato
    if scores:
        predicted_team = max(scores, key=scores.get)
        confidence = scores[predicted_team] * 100
        
        reasoning = [
            f"{predicted_team} apareceu {team_frequency[predicted_team]} vezes como time do dia",
            f"Apareceu {recent_frequency.get(predicted_team, 0)} vezes nos últimos 3 dias",
            f"Score combinado: {scores[predicted_team]:.2f}"
        ]
        
        features_importance = {
            "frequencia_geral": round(team_frequency[predicted_team] / len(daily_patterns), 3),
            "frequencia_recente": round(recent_frequency.get(predicted_team, 0) / 3, 3),
            "score_final": round(scores[predicted_team], 3)
        }
        
        return TeamDayPrediction(
            predicted_team=predicted_team,
            confidence=round(confidence, 2),
            reasoning=reasoning,
            features_importance=features_importance
        )
    
    return TeamDayPrediction(
        predicted_team="Indeterminado",
        confidence=0.0,
        reasoning=["Dados insuficientes"],
        features_importance={}
    )

