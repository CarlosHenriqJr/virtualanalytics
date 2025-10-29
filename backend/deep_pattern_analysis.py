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

<<<<<<< HEAD
class FullAnalysisResponse(BaseModel):
    """Resposta da análise completa (novo endpoint /full)"""
    team_analysis: DeepPatternResponse
    prediction_data: Dict[str, Any]
    executive_summary: Dict[str, Any]
    actionable_insights: List[str]

# ==================== ENDPOINTS ====================
=======
# ==================== ENDPOINT PRINCIPAL ====================
>>>>>>> 2f592652b50a0514f6e87fc5b7d4e02582d6d746

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

<<<<<<< HEAD

@deep_pattern_router.post("/full")
async def full_deep_analysis(request: DeepPatternRequest):
    """
    🚀 ANÁLISE COMPLETA E DEFINITIVA - Combina todas as análises em um único resultado!
    
    Este endpoint une:
    ✅ Análise profunda do time
    ✅ Predição de padrões futuros
    ✅ Resumo executivo
    ✅ Insights acionáveis
    
    Perfeito para: Dashboards, relatórios completos e tomada de decisão.
    """
    try:
        db = await get_database()
        
        # 1️⃣ ANÁLISE DO TIME
        team_analysis_response = await analyze_team_deep_patterns(request)
        
        # 2️⃣ BUSCAR DADOS HISTÓRICOS PARA PREDIÇÃO
        cursor = db.partidas.find({
            "date": {
                "$gte": request.start_date,
                "$lte": request.end_date
            }
        }).sort([("date", 1)])
        
        all_matches = await cursor.to_list(length=None)
        
        # Agrupar por data
        games_by_date = defaultdict(list)
        for match in all_matches:
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
        
        # 3️⃣ PREDIÇÃO DO PRÓXIMO TIME DO DIA
        if len(daily_patterns) >= 3:
            prediction = predict_next_team_of_day(daily_patterns)
        else:
            prediction = TeamDayPrediction(
                predicted_team="Dados insuficientes",
                confidence=0.0,
                reasoning=["Necessário pelo menos 3 dias de histórico"],
                features_importance={}
            )
        
        prediction_data = {
            "historical_patterns": daily_patterns,
            "next_team_prediction": prediction,
            "total_days_analyzed": len(daily_patterns)
        }
        
        # 4️⃣ RESUMO EXECUTIVO
        executive_summary = {
            "team": request.team_name,
            "period": f"{request.start_date} a {request.end_date}",
            "performance": {
                "over35_rate": team_analysis_response.over35_rate,
                "total_games": team_analysis_response.total_games,
                "over35_count": team_analysis_response.over35_games,
                "rating": get_performance_rating(team_analysis_response.over35_rate)
            },
            "key_factors": extract_key_factors(team_analysis_response),
            "risk_level": calculate_risk_level(team_analysis_response),
            "opportunity_score": calculate_opportunity_score(team_analysis_response)
        }
        
        # 5️⃣ INSIGHTS ACIONÁVEIS
        actionable_insights = generate_actionable_insights(
            team_analysis_response,
            prediction,
            daily_patterns
        )
        
        return FullAnalysisResponse(
            team_analysis=team_analysis_response,
            prediction_data=prediction_data,
            executive_summary=executive_summary,
            actionable_insights=actionable_insights
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

=======
# ==================== ENDPOINT DE PREDIÇÃO ====================
>>>>>>> 2f592652b50a0514f6e87fc5b7d4e02582d6d746

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

<<<<<<< HEAD

@deep_pattern_router.get("/teams")
async def get_available_teams(start_date: Optional[str] = None, end_date: Optional[str] = None):
    """
    Retorna lista de times disponíveis para análise.
    Opcionalmente filtra por período.
    """
    try:
        db = await get_database()
        
        # Construir query
        query = {}
        if start_date and end_date:
            query["date"] = {"$gte": start_date, "$lte": end_date}
        
        # Buscar todos os times únicos (casa e fora)
        pipeline = [
            {"$match": query} if query else {"$match": {}},
            {
                "$group": {
                    "_id": None,
                    "home_teams": {"$addToSet": "$timeCasa"},
                    "away_teams": {"$addToSet": "$timeFora"}
                }
            }
        ]
        
        result = await db.partidas.aggregate(pipeline).to_list(length=1)
        
        if not result:
            return {"teams": [], "total": 0}
        
        # Combinar times de casa e fora, remover vazios e ordenar
        home_teams = set(result[0].get("home_teams", []))
        away_teams = set(result[0].get("away_teams", []))
        all_teams = sorted(home_teams.union(away_teams) - {None, ""})
        
        return {
            "teams": all_teams,
            "total": len(all_teams),
            "period": f"{start_date} a {end_date}" if start_date and end_date else "todos os períodos"
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

=======
>>>>>>> 2f592652b50a0514f6e87fc5b7d4e02582d6d746
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

<<<<<<< HEAD
# def process_game(match: dict, team_name: str, standings_over_time: Dict[str, Dict[str, int]]) -> GamePattern:
#     """Processa um jogo e extrai padrões."""
#     date = match.get("date", "")
#     time = match.get("hour", "")
#     home_team = match.get("timeCasa", "")
#     away_team = match.get("timeFora", "")
#     home_goals = match.get("placarCasaFT", 0)
#     away_goals = match.get("placarForaFT", 0)
#     total_goals = match.get("totalGolsFT", 0)
    
#     is_home = (team_name == home_team)
#     opponent = away_team if is_home else home_team
#     score = f"{home_goals}-{away_goals}"
#     is_over35 = total_goals > 3.5
    
#     # Obter posições na tabela
#     positions = standings_over_time.get(date, {})
#     team_position = positions.get(team_name, 99)
#     opponent_position = positions.get(opponent, 99)
#     position_diff = abs(team_position - opponent_position)
    
#     # Determinar tipo de confronto
#     if position_diff <= 3:
#         matchup_type = "equilibrado"
#     elif team_position < opponent_position:
#         matchup_type = "forte_vs_fraco"
#     else:
#         matchup_type = "fraco_vs_forte"
    
#     return GamePattern(
#         date=date,
#         time=time,
#         opponent=opponent,
#         is_home=is_home,
#         score=score,
#         total_goals=total_goals,
#         team_position=team_position,
#         opponent_position=opponent_position,
#         position_diff=position_diff,
#         is_over35=is_over35,
#         odds=None,
#         matchup_type=matchup_type
#     )

def process_game(match: dict, team_name: str, standings_over_time: Dict[str, Dict[str, int]]) -> GamePattern:
    """Processa um jogo e extrai padrões."""
    date = match.get("date", "")
    
    # ✅ CORREÇÃO: Converter hour para string
    hour_value = match.get("hour", "")
    if isinstance(hour_value, int):
        time = f"{hour_value:02d}:00"  # Converte 11 → "11:00"
    elif isinstance(hour_value, str):
        time = hour_value
    else:
        time = ""
    
=======
def process_game(match: dict, team_name: str, standings_over_time: Dict[str, Dict[str, int]]) -> GamePattern:
    """Processa um jogo e extrai padrões."""
    date = match.get("date", "")
    time = match.get("hour", "")
>>>>>>> 2f592652b50a0514f6e87fc5b7d4e02582d6d746
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
    
<<<<<<< HEAD
    # ✅ OBTER ODDS DO CAMPO MARKETS
    markets = match.get("markets", {})
    over35_odds = markets.get("TotalGols_MaisDe_35")
    
    # ✅ CRIAR O GamePattern COM DADOS COMPLETOS
    game_pattern = GamePattern(
=======
    return GamePattern(
>>>>>>> 2f592652b50a0514f6e87fc5b7d4e02582d6d746
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
<<<<<<< HEAD
        odds=over35_odds,  # Odds específicas do Over 3.5
        matchup_type=matchup_type
    )
    
    # ✅ ADICIONAR DADOS COMPLETOS DA PARTIDA PARA ANÁLISE DETALHADA
    game_pattern._match_data = match  # Dados completos
    game_pattern._team_name = team_name  # Nome do time analisado
    game_pattern._markets = markets  # Todos os mercados disponíveis
    
    return game_pattern


def analyze_similarity(over35_games: List[GamePattern], all_games: List[GamePattern]) -> SimilarityAnalysis:
    """Analisa similaridade entre jogos Over 3.5 com foco no adversário, odds e horários."""
=======
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
>>>>>>> 2f592652b50a0514f6e87fc5b7d4e02582d6d746
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
    
<<<<<<< HEAD
    # ✅ ANÁLISE ESPECÍFICA DO ADVERSÁRIO
    opponent_analysis = analyze_opponent_patterns(over35_games)
    
    # ✅ ANÁLISE DE HORÁRIOS
    time_analysis = analyze_time_patterns(over35_games)
    
    # ✅ ANÁLISE DE ODDS (se disponível)
    odds_analysis = analyze_odds_patterns(over35_games)
=======
    # Análise de ODDs (se disponível)
    odds_analysis = {
        "available": False,
        "note": "Dados de ODDs não disponíveis nos jogos"
    }
>>>>>>> 2f592652b50a0514f6e87fc5b7d4e02582d6d746
    
    # Análise de posições
    team_positions = [g.team_position for g in over35_games if g.team_position < 99]
    opponent_positions = [g.opponent_position for g in over35_games if g.opponent_position < 99]
    position_diffs = [g.position_diff for g in over35_games if g.position_diff < 99]
    
    position_analysis = {
        "avg_team_position": round(statistics.mean(team_positions), 1) if team_positions else None,
        "avg_opponent_position": round(statistics.mean(opponent_positions), 1) if opponent_positions else None,
        "avg_position_diff": round(statistics.mean(position_diffs), 1) if position_diffs else None,
        "min_position_diff": min(position_diffs) if position_diffs else None,
<<<<<<< HEAD
        "max_position_diff": max(position_diffs) if position_diffs else None,
        # ✅ ADICIONADO: Análise específica do adversário
        "opponent_analysis": opponent_analysis
=======
        "max_position_diff": max(position_diffs) if position_diffs else None
>>>>>>> 2f592652b50a0514f6e87fc5b7d4e02582d6d746
    }
    
    # Análise de tipo de confronto
    matchup_types = Counter([g.matchup_type for g in over35_games])
    matchup_analysis = {
        "types": dict(matchup_types),
<<<<<<< HEAD
        "most_common": matchup_types.most_common(1)[0][0] if matchup_types else None,
        # ✅ ADICIONADO: Horários mais comuns
        "time_patterns": time_analysis,
        # ✅ ADICIONADO: Padrões de odds
        "odds_patterns": odds_analysis.get("patterns", {})
    }
    
    # Resumo expandido
=======
        "most_common": matchup_types.most_common(1)[0][0] if matchup_types else None
    }
    
    # Resumo
>>>>>>> 2f592652b50a0514f6e87fc5b7d4e02582d6d746
    summary = f"Dos {len(over35_games)} jogos Over 3.5: "
    summary += f"{home_count} em casa ({common_patterns['home_rate']}%), "
    summary += f"{away_count} fora ({common_patterns['away_rate']}%). "
    
    if position_analysis["avg_position_diff"]:
        summary += f"Diferença média de posições: {position_analysis['avg_position_diff']}. "
    
    if matchup_analysis["most_common"]:
<<<<<<< HEAD
        summary += f"Tipo de confronto mais comum: {matchup_analysis['most_common']}. "
    
    # ✅ ADICIONADO: Resumo do adversário
    if opponent_analysis["most_common_opponents"]:
        top_opponent = opponent_analysis["most_common_opponents"][0]
        summary += f"Adversário mais comum: {top_opponent['opponent']} ({top_opponent['count']} jogos). "
    
    # ✅ ADICIONADO: Resumo de horários
    if time_analysis["most_common_times"]:
        top_time = time_analysis["most_common_times"][0]
        summary += f"Horário mais frequente: {top_time['time']} ({top_time['count']} jogos)."
=======
        summary += f"Tipo de confronto mais comum: {matchup_analysis['most_common']}."
>>>>>>> 2f592652b50a0514f6e87fc5b7d4e02582d6d746
    
    return SimilarityAnalysis(
        total_over35_games=len(over35_games),
        common_patterns=common_patterns,
        odds_analysis=odds_analysis,
        position_analysis=position_analysis,
        matchup_analysis=matchup_analysis,
        summary=summary
    )

<<<<<<< HEAD
# ✅ NOVA FUNÇÃO: Análise específica dos adversários
def analyze_opponent_patterns(over35_games: List[GamePattern]) -> Dict[str, Any]:
    """Analisa padrões específicos dos adversários nos jogos Over 3.5."""
    if not over35_games:
        return {}
    
    opponent_stats = {}
    
    for game in over35_games:
        opponent = game.opponent
        if opponent not in opponent_stats:
            opponent_stats[opponent] = {
                "count": 0,
                "positions": [],
                "is_home_against": [],
                "total_goals": []
            }
        
        opponent_stats[opponent]["count"] += 1
        opponent_stats[opponent]["positions"].append(game.opponent_position)
        opponent_stats[opponent]["is_home_against"].append(game.is_home)
        opponent_stats[opponent]["total_goals"].append(game.total_goals)
    
    # Processar estatísticas por adversário
    opponent_analysis = []
    for opponent, stats in opponent_stats.items():
        avg_position = statistics.mean(stats["positions"]) if stats["positions"] else 99
        home_games = sum(stats["is_home_against"])
        away_games = len(stats["is_home_against"]) - home_games
        avg_goals = statistics.mean(stats["total_goals"]) if stats["total_goals"] else 0
        
        opponent_analysis.append({
            "opponent": opponent,
            "count": stats["count"],
            "avg_position": round(avg_position, 1),
            "home_games": home_games,
            "away_games": away_games,
            "avg_total_goals": round(avg_goals, 1),
            "frequency_rate": round((stats["count"] / len(over35_games)) * 100, 1)
        })
    
    # Ordenar por frequência
    opponent_analysis.sort(key=lambda x: x["count"], reverse=True)
    
    return {
        "most_common_opponents": opponent_analysis[:10],  # Top 10 adversários
        "total_unique_opponents": len(opponent_analysis),
        "avg_opponent_position": round(statistics.mean([o["avg_position"] for o in opponent_analysis]), 1),
        "strongest_opponent": min(opponent_analysis, key=lambda x: x["avg_position"]) if opponent_analysis else None,
        "weakest_opponent": max(opponent_analysis, key=lambda x: x["avg_position"]) if opponent_analysis else None
    }

# ✅ NOVA FUNÇÃO: Análise de padrões de horário
def analyze_time_patterns(over35_games: List[GamePattern]) -> Dict[str, Any]:
    """Analisa padrões de horário nos jogos Over 3.5."""
    if not over35_games:
        return {}
    
    time_slots = defaultdict(int)
    time_details = defaultdict(list)
    
    for game in over35_games:
        time_str = game.time
        if time_str:
            # Agrupar por slot de horário
            try:
                hour = int(time_str.split(':')[0])
                slot = f"{hour:02d}:00-{hour:02d}:59"
                time_slots[slot] += 1
                time_details[slot].append({
                    "total_goals": game.total_goals,
                    "opponent": game.opponent,
                    "is_home": game.is_home
                })
            except (ValueError, IndexError):
                # Se não conseguir parsear o horário, usar como está
                time_slots[time_str] += 1
                time_details[time_str].append({
                    "total_goals": game.total_goals,
                    "opponent": game.opponent,
                    "is_home": game.is_home
                })
    
    # Processar estatísticas por horário
    time_analysis = []
    for time_slot, count in time_slots.items():
        details = time_details[time_slot]
        avg_goals = statistics.mean([d["total_goals"] for d in details]) if details else 0
        home_games = sum(1 for d in details if d["is_home"])
        
        time_analysis.append({
            "time": time_slot,
            "count": count,
            "frequency_rate": round((count / len(over35_games)) * 100, 1),
            "avg_total_goals": round(avg_goals, 1),
            "home_games": home_games,
            "away_games": count - home_games
        })
    
    # Ordenar por frequência
    time_analysis.sort(key=lambda x: x["count"], reverse=True)
    
    return {
        "most_common_times": time_analysis[:5],  # Top 5 horários
        "total_time_slots": len(time_analysis),
        "time_with_most_goals": max(time_analysis, key=lambda x: x["avg_total_goals"]) if time_analysis else None,
        "time_with_least_goals": min(time_analysis, key=lambda x: x["avg_total_goals"]) if time_analysis else None
    }

# ✅ FUNÇÃO ATUALIZADA: Análise de padrões de odds com suporte ao campo markets
def analyze_odds_patterns(over35_games: List[GamePattern]) -> Dict[str, Any]:
    """Analisa padrões de odds nos jogos Over 3.5, buscando no campo markets."""
    
    # Coletar todas as odds disponíveis no campo markets
    all_odds_data = []
    markets_analysis = {}
    
    for game in over35_games:
        # ✅ ACESSAR AS ODDS DO CAMPO MARKETS
        match_data = getattr(game, '_match_data', {})
        markets = match_data.get('markets', {})
        
        if markets:
            # Adicionar referência ao jogo para análise detalhada
            game_odds = {
                'date': game.date,
                'team': getattr(game, '_team_name', ''),
                'opponent': game.opponent,
                'total_goals': game.total_goals,
                'markets': markets
            }
            all_odds_data.append(game_odds)
            
            # Coletar todas as odds disponíveis para análise agregada
            for market_name, odds_value in markets.items():
                if isinstance(odds_value, (int, float)) and odds_value > 0:
                    if market_name not in markets_analysis:
                        markets_analysis[market_name] = {
                            'values': [],
                            'games_count': 0,
                            'min_odds': float('inf'),
                            'max_odds': 0,
                            'games': []
                        }
                    
                    markets_analysis[market_name]['values'].append(odds_value)
                    markets_analysis[market_name]['games_count'] += 1
                    markets_analysis[market_name]['min_odds'] = min(markets_analysis[market_name]['min_odds'], odds_value)
                    markets_analysis[market_name]['max_odds'] = max(markets_analysis[market_name]['max_odds'], odds_value)
                    markets_analysis[market_name]['games'].append({
                        'date': game.date,
                        'odds': odds_value,
                        'total_goals': game.total_goals
                    })
    
    if not all_odds_data:
        return {
            "available": False,
            "note": "Dados de ODDs não disponíveis nos jogos Over 3.5",
            "patterns": {},
            "markets_analysis": {}
        }
    
    # ✅ ANÁLISE DETALHADA POR MERCADO
    detailed_markets_analysis = {}
    for market_name, data in markets_analysis.items():
        if data['values']:
            detailed_markets_analysis[market_name] = {
                'total_games': data['games_count'],
                'average_odds': round(statistics.mean(data['values']), 2),
                'min_odds': round(data['min_odds'], 2),
                'max_odds': round(data['max_odds'], 2),
                'median_odds': round(statistics.median(data['values']), 2),
                'std_deviation': round(statistics.stdev(data['values']), 2) if len(data['values']) > 1 else 0,
                'coverage_rate': round((data['games_count'] / len(over35_games)) * 100, 1),
                'sample_games': data['games'][:3]  # Mostrar 3 jogos de exemplo
            }
    
    # ✅ ANÁLISE DOS MERCADOS MAIS RELEVANTES PARA OVER 3.5
    # Focar nos mercados relacionados a total de gols
    relevant_markets = {
        'TotalGols_MaisDe_35': 'Over 3.5 Gols',
        'TotalGols_MaisDe_25': 'Over 2.5 Gols', 
        'TotalGols_MaisDe_15': 'Over 1.5 Gols',
        'TotalGols_MenosDe_35': 'Under 3.5 Gols',
        'GolsExatos_4': '4 Gols Exatos',
        'GolsExatos_5_Mais': '5+ Gols Exatos',
        'TotalGols_MaisDe_05': 'Over 0.5 Gols'
    }
    
    relevant_analysis = {}
    for market_key, market_name in relevant_markets.items():
        if market_key in detailed_markets_analysis:
            relevant_analysis[market_name] = detailed_markets_analysis[market_key]
    
    # ✅ ANÁLISE DAS ODDS DO MERCADO OVER 3.5 ESPECIFICAMENTE
    over35_odds_analysis = {}
    if 'TotalGols_MaisDe_35' in detailed_markets_analysis:
        over35_data = detailed_markets_analysis['TotalGols_MaisDe_35']
        over35_odds = [game['odds'] for game in markets_analysis['TotalGols_MaisDe_35']['games']]
        
        # Agrupar por faixas de odds
        odds_ranges = {
            "Baixa (1.0-2.0)": 0,
            "Média-Baixa (2.0-3.0)": 0,
            "Média (3.0-4.0)": 0,
            "Média-Alta (4.0-6.0)": 0,
            "Alta (6.0-10.0)": 0,
            "Muito Alta (10.0+)": 0
        }
        
        for odds in over35_odds:
            if 1.0 <= odds < 2.0:
                odds_ranges["Baixa (1.0-2.0)"] += 1
            elif 2.0 <= odds < 3.0:
                odds_ranges["Média-Baixa (2.0-3.0)"] += 1
            elif 3.0 <= odds < 4.0:
                odds_ranges["Média (3.0-4.0)"] += 1
            elif 4.0 <= odds < 6.0:
                odds_ranges["Média-Alta (4.0-6.0)"] += 1
            elif 6.0 <= odds < 10.0:
                odds_ranges["Alta (6.0-10.0)"] += 1
            else:
                odds_ranges["Muito Alta (10.0+)"] += 1
        
        over35_odds_analysis = {
            "distribution": odds_ranges,
            "most_common_range": max(odds_ranges.items(), key=lambda x: x[1])[0],
            "confidence": min(100, (over35_data['total_games'] / len(over35_games)) * 100)
        }
    
    return {
        "available": True,
        "total_games_with_odds": len(all_odds_data),
        "total_over35_games": len(over35_games),
        "coverage_rate": round((len(all_odds_data) / len(over35_games)) * 100, 1),
        "total_markets_available": len(detailed_markets_analysis),
        
        # ✅ ANÁLISE DETALHADA DE TODOS OS MERCADOS
        "all_markets_analysis": detailed_markets_analysis,
        
        # ✅ ANÁLISE DOS MERCADOS MAIS RELEVANTES
        "relevant_markets_analysis": relevant_analysis,
        
        # ✅ ANÁLISE ESPECÍFICA DO OVER 3.5
        "over35_specific_analysis": over35_odds_analysis,
        
        # ✅ PADRÕES GERAIS
        "patterns": {
            "total_markets_found": len(detailed_markets_analysis),
            "markets_with_best_coverage": dict(sorted(
                [(k, v) for k, v in detailed_markets_analysis.items()],
                key=lambda x: x[1]['coverage_rate'],
                reverse=True
            )[:5]),
            "most_volatile_markets": dict(sorted(
                [(k, v) for k, v in detailed_markets_analysis.items() if v['std_deviation'] > 0],
                key=lambda x: x[1]['std_deviation'],
                reverse=True
            )[:3])
        }
    }

# ✅ ATUALIZAR função generate_insights para incluir as novas análises
def generate_insights(team_name: str, over35_rate: float, similarity: SimilarityAnalysis, 
                     correlation: CorrelationAnalysis, over35_games: List[GamePattern]) -> List[str]:
    """Gera insights baseados nas análises expandidas."""
    insights = []
    
    insights.append(f"📊 {team_name} teve {over35_rate:.1f}% de Over 3.5 no período ({similarity.total_over35_games} jogos)")
    
    if similarity.common_patterns:
        home_rate = similarity.common_patterns.get("home_rate", 0)
        away_rate = similarity.common_patterns.get("away_rate", 0)
        
        if home_rate > away_rate + 10:
            insights.append(f"🏠 Over 3.5 mais frequente em casa ({home_rate:.1f}%) do que fora ({away_rate:.1f}%)")
        elif away_rate > home_rate + 10:
            insights.append(f"✈️ Over 3.5 mais frequente fora ({away_rate:.1f}%) do que em casa ({home_rate:.1f}%)")
        else:
            insights.append(f"⚖️ Over 3.5 equilibrado entre casa ({home_rate:.1f}%) e fora ({away_rate:.1f}%)")
    
    if similarity.position_analysis.get("avg_team_position"):
        avg_pos = similarity.position_analysis["avg_team_position"]
        insights.append(f"📍 Nos jogos Over 3.5, {team_name} estava em média na {avg_pos:.0f}ª posição")
    
    # ✅ NOVO INSIGHT: Posição dos adversários
    if similarity.position_analysis.get("opponent_analysis", {}).get("avg_opponent_position"):
        avg_opp_pos = similarity.position_analysis["opponent_analysis"]["avg_opponent_position"]
        insights.append(f"🛡️ Adversários nos jogos Over 3.5 estavam em média na {avg_opp_pos:.0f}ª posição")
    
    if similarity.matchup_analysis.get("most_common"):
        matchup = similarity.matchup_analysis["most_common"]
        insights.append(f"🎯 Tipo de confronto mais comum em Over 3.5: {matchup}")
    
    # ✅ NOVO INSIGHT: Adversários mais comuns
    opponent_analysis = similarity.position_analysis.get("opponent_analysis", {})
    if opponent_analysis.get("most_common_opponents"):
        top_opponents = opponent_analysis["most_common_opponents"][:3]
        opponents_str = ", ".join([f"{o['opponent']}({o['count']}x)" for o in top_opponents])
        insights.append(f"⚔️ Adversários mais frequentes em Over 3.5: {opponents_str}")
    
    # ✅ NOVO INSIGHT: Padrões de horário
    time_analysis = similarity.matchup_analysis.get("time_patterns", {})
    if time_analysis.get("most_common_times"):
        top_time = time_analysis["most_common_times"][0]
        insights.append(f"🕐 Horário mais comum em Over 3.5: {top_time['time']} ({top_time['count']} jogos, {top_time['frequency_rate']}%)")
    
    # ✅ INSIGHT ATUALIZADO: Padrões de odds
    odds_analysis = similarity.odds_analysis
    if odds_analysis.get("available"):
        if odds_analysis.get("over35_specific_analysis"):
            over35_analysis = odds_analysis["over35_specific_analysis"]
            insights.append(f"💰 Mercado Over 3.5: {over35_analysis.get('most_common_range', 'N/A')}")
        
        if odds_analysis.get("relevant_markets_analysis"):
            relevant_markets = odds_analysis["relevant_markets_analysis"]
            if 'Over 3.5 Gols' in relevant_markets:
                over35_data = relevant_markets['Over 3.5 Gols']
                insights.append(f"📈 Odds média Over 3.5: {over35_data['average_odds']} (min: {over35_data['min_odds']}, max: {over35_data['max_odds']})")
    
    if abs(correlation.position_diff_correlation) >= 0.3:
        if correlation.position_diff_correlation > 0:
            insights.append(f"📈 Maior diferença de posições tende a resultar em Over 3.5 (correlação: {correlation.position_diff_correlation:.2f})")
        else:
            insights.append(f"📉 Menor diferença de posições tende a resultar em Over 3.5 (correlação: {correlation.position_diff_correlation:.2f})")
    
    return insights

def analyze_correlations(all_games: List[GamePattern], over35_games: List[GamePattern]) -> CorrelationAnalysis:
    """Analisa correlações entre variáveis e Over 3.5."""
=======
def analyze_correlations(all_games: List[GamePattern], over35_games: List[GamePattern]) -> CorrelationAnalysis:
    """
    Analisa correlações entre variáveis e Over 3.5.
    """
>>>>>>> 2f592652b50a0514f6e87fc5b7d4e02582d6d746
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
    
<<<<<<< HEAD
    insights.append(f"📊 {team_name} teve {over35_rate:.1f}% de Over 3.5 no período ({similarity.total_over35_games} jogos)")
    
=======
    # Insight 1: Taxa geral
    insights.append(f"📊 {team_name} teve {over35_rate:.1f}% de Over 3.5 no período ({similarity.total_over35_games} jogos)")
    
    # Insight 2: Casa vs Fora
>>>>>>> 2f592652b50a0514f6e87fc5b7d4e02582d6d746
    if similarity.common_patterns:
        home_rate = similarity.common_patterns.get("home_rate", 0)
        away_rate = similarity.common_patterns.get("away_rate", 0)
        
        if home_rate > away_rate + 10:
            insights.append(f"🏠 Over 3.5 mais frequente em casa ({home_rate:.1f}%) do que fora ({away_rate:.1f}%)")
        elif away_rate > home_rate + 10:
            insights.append(f"✈️ Over 3.5 mais frequente fora ({away_rate:.1f}%) do que em casa ({home_rate:.1f}%)")
        else:
            insights.append(f"⚖️ Over 3.5 equilibrado entre casa ({home_rate:.1f}%) e fora ({away_rate:.1f}%)")
    
<<<<<<< HEAD
=======
    # Insight 3: Posição na tabela
>>>>>>> 2f592652b50a0514f6e87fc5b7d4e02582d6d746
    if similarity.position_analysis.get("avg_team_position"):
        avg_pos = similarity.position_analysis["avg_team_position"]
        insights.append(f"📍 Nos jogos Over 3.5, {team_name} estava em média na {avg_pos:.0f}ª posição")
    
<<<<<<< HEAD
=======
    # Insight 4: Tipo de confronto
>>>>>>> 2f592652b50a0514f6e87fc5b7d4e02582d6d746
    if similarity.matchup_analysis.get("most_common"):
        matchup = similarity.matchup_analysis["most_common"]
        insights.append(f"🎯 Tipo de confronto mais comum em Over 3.5: {matchup}")
    
<<<<<<< HEAD
=======
    # Insight 5: Correlação
>>>>>>> 2f592652b50a0514f6e87fc5b7d4e02582d6d746
    if abs(correlation.position_diff_correlation) >= 0.3:
        if correlation.position_diff_correlation > 0:
            insights.append(f"📈 Maior diferença de posições tende a resultar em Over 3.5 (correlação: {correlation.position_diff_correlation:.2f})")
        else:
            insights.append(f"📉 Menor diferença de posições tende a resultar em Over 3.5 (correlação: {correlation.position_diff_correlation:.2f})")
    
    return insights

def generate_recommendations(similarity: SimilarityAnalysis, correlation: CorrelationAnalysis) -> List[str]:
    """Gera recomendações baseadas nas análises."""
    recommendations = []
    
<<<<<<< HEAD
=======
    # Recomendação 1: Casa vs Fora
>>>>>>> 2f592652b50a0514f6e87fc5b7d4e02582d6d746
    if similarity.common_patterns:
        home_rate = similarity.common_patterns.get("home_rate", 0)
        away_rate = similarity.common_patterns.get("away_rate", 0)
        
        if home_rate > 60:
            recommendations.append("✅ Priorize jogos em casa - maior taxa de Over 3.5")
        elif away_rate > 60:
            recommendations.append("✅ Priorize jogos fora - maior taxa de Over 3.5")
    
<<<<<<< HEAD
=======
    # Recomendação 2: Força do adversário
>>>>>>> 2f592652b50a0514f6e87fc5b7d4e02582d6d746
    if correlation.opponent_strength_impact:
        vs_weak = correlation.opponent_strength_impact.get("vs_weak_over35_rate", 0)
        vs_strong = correlation.opponent_strength_impact.get("vs_strong_over35_rate", 0)
        
        if vs_weak > vs_strong + 10:
            recommendations.append("✅ Foque em jogos contra adversários mais fracos")
        elif vs_strong > vs_weak + 10:
            recommendations.append("✅ Jogos contra adversários fortes tendem a ter mais gols")
    
<<<<<<< HEAD
=======
    # Recomendação 3: Tipo de confronto
>>>>>>> 2f592652b50a0514f6e87fc5b7d4e02582d6d746
    if similarity.matchup_analysis.get("most_common"):
        matchup = similarity.matchup_analysis["most_common"]
        recommendations.append(f"✅ Padrão identificado: {matchup} - busque jogos similares")
    
<<<<<<< HEAD
=======
    # Recomendação 4: Posição
>>>>>>> 2f592652b50a0514f6e87fc5b7d4e02582d6d746
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
    
<<<<<<< HEAD
=======
    # Encontrar o time com maior taxa de Over 3.5
>>>>>>> 2f592652b50a0514f6e87fc5b7d4e02582d6d746
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

<<<<<<< HEAD

def predict_next_team_of_day(daily_patterns: List[Dict[str, Any]]) -> TeamDayPrediction:
    """Prediz o próximo time do dia baseado em padrões históricos."""
    team_frequency = Counter([p["team"] for p in daily_patterns])
    recent_teams = [p["team"] for p in daily_patterns[-3:]]
    recent_frequency = Counter(recent_teams)
    
=======
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
>>>>>>> 2f592652b50a0514f6e87fc5b7d4e02582d6d746
    scores = {}
    for team in team_frequency:
        general_score = team_frequency[team] / len(daily_patterns)
        recent_score = recent_frequency.get(team, 0) / 3
<<<<<<< HEAD
        scores[team] = (general_score * 0.4) + (recent_score * 0.6)
    
=======
        scores[team] = (general_score * 0.4) + (recent_score * 0.6)  # Peso maior para recente
    
    # Melhor candidato
>>>>>>> 2f592652b50a0514f6e87fc5b7d4e02582d6d746
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

<<<<<<< HEAD
# ==================== FUNÇÕES DO ENDPOINT /FULL ====================

def get_performance_rating(over35_rate: float) -> str:
    """Classifica a performance baseado na taxa de Over 3.5."""
    if over35_rate >= 70:
        return "🔥 EXCELENTE"
    elif over35_rate >= 60:
        return "⭐ MUITO BOM"
    elif over35_rate >= 50:
        return "✅ BOM"
    elif over35_rate >= 40:
        return "⚠️ MODERADO"
    else:
        return "❌ BAIXO"

def extract_key_factors(analysis: DeepPatternResponse) -> List[str]:
    """Extrai os fatores-chave da análise."""
    factors = []
    
    # Fator 1: Casa vs Fora
    if analysis.similarity_analysis.common_patterns:
        home_rate = analysis.similarity_analysis.common_patterns.get("home_rate", 0)
        away_rate = analysis.similarity_analysis.common_patterns.get("away_rate", 0)
        
        if abs(home_rate - away_rate) > 15:
            location = "casa" if home_rate > away_rate else "fora"
            factors.append(f"Melhor performance jogando {location}")
    
    # Fator 2: Tipo de confronto
    if analysis.similarity_analysis.matchup_analysis.get("most_common"):
        matchup = analysis.similarity_analysis.matchup_analysis["most_common"]
        factors.append(f"Padrão predominante: {matchup}")
    
    # Fator 3: Força do adversário
    vs_weak = analysis.correlation_analysis.opponent_strength_impact.get("vs_weak_over35_rate", 0)
    vs_strong = analysis.correlation_analysis.opponent_strength_impact.get("vs_strong_over35_rate", 0)
    
    if abs(vs_weak - vs_strong) > 15:
        opponent_type = "fracos" if vs_weak > vs_strong else "fortes"
        factors.append(f"Melhores resultados contra adversários {opponent_type}")
    
    return factors if factors else ["Padrões não conclusivos"]

def calculate_risk_level(analysis: DeepPatternResponse) -> str:
    """Calcula o nível de risco baseado na consistência."""
    over35_rate = analysis.over35_rate
    total_games = analysis.total_games
    
    # Risco baseado em taxa e volume
    if total_games < 5:
        return "⚠️ ALTO (Dados insuficientes)"
    elif over35_rate >= 65 and total_games >= 10:
        return "🟢 BAIXO (Alta consistência)"
    elif over35_rate >= 50:
        return "🟡 MODERADO (Consistência razoável)"
    else:
        return "🔴 ALTO (Baixa taxa de sucesso)"

def calculate_opportunity_score(analysis: DeepPatternResponse) -> float:
    """Calcula um score de oportunidade (0-100)."""
    # Componentes do score
    rate_score = analysis.over35_rate  # 0-100
    
    # Volume de dados
    volume_score = min(analysis.total_games * 5, 30)  # Max 30 pontos
    
    # Consistência (baseado na diferença casa/fora)
    home_rate = analysis.similarity_analysis.common_patterns.get("home_rate", 50)
    away_rate = analysis.similarity_analysis.common_patterns.get("away_rate", 50)
    consistency_score = max(0, 20 - abs(home_rate - away_rate))  # Max 20 pontos
    
    total_score = (rate_score * 0.5) + volume_score + consistency_score
    
    return round(min(total_score, 100), 2)

def generate_actionable_insights(
    analysis: DeepPatternResponse,
    prediction: TeamDayPrediction,
    daily_patterns: List[Dict[str, Any]]
) -> List[str]:
    """Gera insights práticos e acionáveis."""
    insights = []
    
    # Insight 1: Melhor momento para apostar
    home_rate = analysis.similarity_analysis.common_patterns.get("home_rate", 0)
    away_rate = analysis.similarity_analysis.common_patterns.get("away_rate", 0)
    
    if home_rate > away_rate + 15:
        insights.append(f"🎯 AÇÃO: Priorize apostas quando {analysis.team_name} jogar EM CASA (taxa {home_rate:.1f}%)")
    elif away_rate > home_rate + 15:
        insights.append(f"🎯 AÇÃO: Priorize apostas quando {analysis.team_name} jogar FORA (taxa {away_rate:.1f}%)")
    
    # Insight 2: Adversários ideais
    vs_weak = analysis.correlation_analysis.opponent_strength_impact.get("vs_weak_over35_rate", 0)
    vs_strong = analysis.correlation_analysis.opponent_strength_impact.get("vs_strong_over35_rate", 0)
    
    if vs_weak > vs_strong + 15:
        insights.append(f"🎯 AÇÃO: Busque jogos contra times das posições 10+ na tabela (taxa {vs_weak:.1f}%)")
    elif vs_strong > vs_weak + 15:
        insights.append(f"🎯 AÇÃO: Paradoxalmente, melhores resultados contra times fortes (taxa {vs_strong:.1f}%)")
    
    # Insight 3: Predição do time do dia
    if prediction.confidence > 40:
        insights.append(f"🔮 PREDIÇÃO: {prediction.predicted_team} tem {prediction.confidence:.0f}% de chance de ser o time do dia")
    
    # Insight 4: Tendência recente
    if len(daily_patterns) >= 5:
        recent_5 = daily_patterns[-5:]
        team_appears = sum(1 for p in recent_5 if p["team"] == analysis.team_name)
        
        if team_appears >= 3:
            insights.append(f"📈 TENDÊNCIA: {analysis.team_name} foi time do dia em {team_appears}/5 dias recentes - momento quente!")
        elif team_appears == 0:
            insights.append(f"📊 OBSERVAÇÃO: {analysis.team_name} não foi time do dia nos últimos 5 dias")
    
    # Insight 5: Score de oportunidade
    opp_score = calculate_opportunity_score(analysis)
    if opp_score >= 70:
        insights.append(f"⭐ OPORTUNIDADE ALTA: Score {opp_score}/100 - Time com padrões fortes e consistentes")
    elif opp_score < 40:
        insights.append(f"⚠️ CAUTELA: Score {opp_score}/100 - Padrões inconsistentes, aguarde mais dados")
    
    return insights if insights else ["Aguarde mais dados para insights acionáveis"]
=======
>>>>>>> 2f592652b50a0514f6e87fc5b7d4e02582d6d746
