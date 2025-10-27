"""
advanced_analysis.py - Sistema de Análise Avançada de Futebol Virtual

Funcionalidades:
1. Tabela de Classificação completa dos times
2. Identificação do "Time do Dia"
3. Análise de Confronto Específico (H2H)
4. Análise de Padrões Visuais (Matriz de Resultados)
5. Mapeamento de Cenários (ODDs, Placares, Padrões Temporais)
"""

from fastapi import APIRouter, HTTPException
from typing import List, Optional, Dict, Any, Tuple
from datetime import datetime, timedelta
from pydantic import BaseModel
from database import get_database
from collections import defaultdict, Counter
import statistics

advanced_analysis_router = APIRouter(prefix="/advanced-analysis", tags=["advanced-analysis"])

# ==================== MODELOS ====================

class AdvancedAnalysisRequest(BaseModel):
    start_date: str  # Data inicial (YYYY-MM-DD)
    end_date: str  # Data final (YYYY-MM-DD)
    target_market: str = "TotalGols_MaisDe_35"  # Mercado alvo

class TeamStats(BaseModel):
    """Estatísticas de um time"""
    team_name: str
    position: int
    points: int
    goal_difference: int
    total_wins: int
    total_losses: int
    total_draws: int
    home_wins: int
    away_wins: int
    over_35_rate: float  # Taxa de Over 3.5
    total_games: int
    over_35_games: int

class TeamOfDay(BaseModel):
    """Time do dia com maior viés para Over 3.5"""
    date: str
    team_name: str
    over_35_rate: float
    recent_form: List[str]  # Últimos resultados (ex: ["W", "W", "L", "D"])
    recent_over_35: int  # Quantos Over 3.5 nos últimos N jogos
    justification: str

class MatchupAnalysis(BaseModel):
    """Análise de confronto específico"""
    home_team: str
    away_team: str
    match_time: str
    home_position: int
    away_position: int
    h2h_total: int
    h2h_over_35: int
    home_over_35_season: int
    away_over_35_season: int
    home_strength: str  # "Forte", "Médio", "Fraco"
    away_strength: str
    prediction: str
    confidence: float

class MatrixMetrics(BaseModel):
    """Métricas da matriz de resultados"""
    total_cells: int
    green_cells: int
    red_cells: int
    accuracy: float
    largest_green_cluster: int
    average_cluster_size: float
    hottest_columns: List[int]
    coldest_columns: List[int]
    hottest_rows: List[int]
    vertical_clusters: List[Dict[str, Any]]
    pattern_summary: str

class ScenarioMapping(BaseModel):
    """Mapeamento de cenários"""
    best_odds_range: Dict[str, Any]
    common_scores: List[Dict[str, Any]]
    best_hours: List[str]
    best_days: List[str]
    success_sequences: List[str]

class AdvancedAnalysisResponse(BaseModel):
    """Resposta completa da análise avançada"""
    standings: List[TeamStats]
    teams_of_day: List[TeamOfDay]
    matchup_analyses: List[MatchupAnalysis]
    matrix_metrics: MatrixMetrics
    scenario_mapping: ScenarioMapping
    insights: List[str]
    recommendations: List[str]

# ==================== ENDPOINT PRINCIPAL ====================

@advanced_analysis_router.post("/full-analysis")
async def perform_advanced_analysis(request: AdvancedAnalysisRequest):
    """
    Realiza análise avançada completa de futebol virtual.
    
    Inclui:
    - Tabela de classificação
    - Time do dia
    - Análise de confrontos
    - Padrões visuais (matriz)
    - Mapeamento de cenários
    """
    try:
        db = await get_database()
        
        # Buscar todos os jogos no período
        start_date = datetime.strptime(request.start_date, "%Y-%m-%d")
        end_date = datetime.strptime(request.end_date, "%Y-%m-%d")
        
        cursor = db.partidas.find({
            "date": {
                "$gte": request.start_date,
                "$lte": request.end_date
            }
        }).sort([("date", 1), ("hour", 1)])
        
        matches = await cursor.to_list(length=None)
        
        if not matches:
            raise HTTPException(status_code=404, detail="Nenhum jogo encontrado no período")
        
        # 1. Calcular tabela de classificação
        standings = calculate_standings(matches, request.target_market)
        
        # 2. Identificar time do dia
        teams_of_day = identify_teams_of_day(matches, standings, request.target_market)
        
        # 3. Analisar confrontos específicos
        matchup_analyses = analyze_matchups(matches, standings, request.target_market)
        
        # 4. Analisar padrões visuais (matriz)
        matrix_metrics = analyze_visual_patterns(matches, request.target_market)
        
        # 5. Mapear cenários
        scenario_mapping = map_scenarios(matches, request.target_market)
        
        # 6. Gerar insights e recomendações
        insights = generate_insights(standings, teams_of_day, matrix_metrics, scenario_mapping)
        recommendations = generate_recommendations(matrix_metrics, scenario_mapping, standings)
        
        return AdvancedAnalysisResponse(
            standings=standings,
            teams_of_day=teams_of_day,
            matchup_analyses=matchup_analyses,
            matrix_metrics=matrix_metrics,
            scenario_mapping=scenario_mapping,
            insights=insights,
            recommendations=recommendations
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==================== FUNÇÕES DE ANÁLISE ====================

def calculate_standings(matches: List[dict], target_market: str) -> List[TeamStats]:
    """
    Calcula a tabela de classificação completa.
    """
    team_stats = defaultdict(lambda: {
        "points": 0,
        "goal_difference": 0,
        "total_wins": 0,
        "total_losses": 0,
        "total_draws": 0,
        "home_wins": 0,
        "away_wins": 0,
        "total_games": 0,
        "over_35_games": 0,
        "goals_for": 0,
        "goals_against": 0
    })
    
    for match in matches:
        home_team = match.get("timeCasa", "Unknown")
        away_team = match.get("timeFora", "Unknown")
        home_goals = match.get("placarCasaFT", 0)
        away_goals = match.get("placarForaFT", 0)
        total_goals = match.get("totalGolsFT", 0)
        
        # Atualizar estatísticas do time da casa
        team_stats[home_team]["total_games"] += 1
        team_stats[home_team]["goals_for"] += home_goals
        team_stats[home_team]["goals_against"] += away_goals
        
        # Atualizar estatísticas do time visitante
        team_stats[away_team]["total_games"] += 1
        team_stats[away_team]["goals_for"] += away_goals
        team_stats[away_team]["goals_against"] += home_goals
        
        # Determinar resultado
        if home_goals > away_goals:
            team_stats[home_team]["points"] += 3
            team_stats[home_team]["total_wins"] += 1
            team_stats[home_team]["home_wins"] += 1
            team_stats[away_team]["total_losses"] += 1
        elif away_goals > home_goals:
            team_stats[away_team]["points"] += 3
            team_stats[away_team]["total_wins"] += 1
            team_stats[away_team]["away_wins"] += 1
            team_stats[home_team]["total_losses"] += 1
        else:
            team_stats[home_team]["points"] += 1
            team_stats[away_team]["points"] += 1
            team_stats[home_team]["total_draws"] += 1
            team_stats[away_team]["total_draws"] += 1
        
        # Verificar Over 3.5
        if total_goals > 3.5:
            team_stats[home_team]["over_35_games"] += 1
            team_stats[away_team]["over_35_games"] += 1
    
    # Calcular saldo de gols e taxa de Over 3.5
    standings = []
    for team_name, stats in team_stats.items():
        goal_diff = stats["goals_for"] - stats["goals_against"]
        over_35_rate = (stats["over_35_games"] / stats["total_games"] * 100) if stats["total_games"] > 0 else 0
        
        standings.append(TeamStats(
            team_name=team_name,
            position=0,  # Será atualizado depois
            points=stats["points"],
            goal_difference=goal_diff,
            total_wins=stats["total_wins"],
            total_losses=stats["total_losses"],
            total_draws=stats["total_draws"],
            home_wins=stats["home_wins"],
            away_wins=stats["away_wins"],
            over_35_rate=round(over_35_rate, 2),
            total_games=stats["total_games"],
            over_35_games=stats["over_35_games"]
        ))
    
    # Ordenar por pontos, depois por saldo de gols
    standings.sort(key=lambda x: (x.points, x.goal_difference), reverse=True)
    
    # Atualizar posições
    for i, team in enumerate(standings, 1):
        team.position = i
    
    return standings

def identify_teams_of_day(matches: List[dict], standings: List[TeamStats], target_market: str) -> List[TeamOfDay]:
    """
    Identifica o time do dia com maior viés para Over 3.5.
    """
    # Agrupar jogos por data
    games_by_date = defaultdict(list)
    for match in matches:
        date = match.get("date", "")
        if date:
            games_by_date[date].append(match)
    
    teams_of_day = []
    
    for date, day_matches in sorted(games_by_date.items()):
        # Calcular estatísticas de cada time no dia
        team_day_stats = defaultdict(lambda: {"over_35": 0, "total": 0, "form": []})
        
        for match in day_matches:
            home_team = match.get("timeCasa", "Unknown")
            away_team = match.get("timeFora", "Unknown")
            total_goals = match.get("totalGolsFT", 0)
            home_goals = match.get("placarCasaFT", 0)
            away_goals = match.get("placarForaFT", 0)
            
            # Atualizar estatísticas
            for team in [home_team, away_team]:
                team_day_stats[team]["total"] += 1
                if total_goals > 3.5:
                    team_day_stats[team]["over_35"] += 1
                
                # Forma (W/L/D)
                if team == home_team:
                    if home_goals > away_goals:
                        team_day_stats[team]["form"].append("W")
                    elif home_goals < away_goals:
                        team_day_stats[team]["form"].append("L")
                    else:
                        team_day_stats[team]["form"].append("D")
                else:
                    if away_goals > home_goals:
                        team_day_stats[team]["form"].append("W")
                    elif away_goals < home_goals:
                        team_day_stats[team]["form"].append("L")
                    else:
                        team_day_stats[team]["form"].append("D")
        
        # Encontrar o time com maior taxa de Over 3.5 no dia
        best_team = None
        best_rate = 0
        
        for team_name, stats in team_day_stats.items():
            if stats["total"] > 0:
                rate = (stats["over_35"] / stats["total"]) * 100
                if rate > best_rate:
                    best_rate = rate
                    best_team = (team_name, stats)
        
        if best_team:
            team_name, stats = best_team
            
            # Buscar estatísticas gerais do time
            team_standing = next((t for t in standings if t.team_name == team_name), None)
            
            justification = f"{team_name} teve {stats['over_35']} Over 3.5 em {stats['total']} jogos no dia ({best_rate:.1f}%)"
            if team_standing:
                justification += f". Taxa geral na temporada: {team_standing.over_35_rate:.1f}%"
            
            teams_of_day.append(TeamOfDay(
                date=date,
                team_name=team_name,
                over_35_rate=round(best_rate, 2),
                recent_form=stats["form"][-5:],  # Últimos 5 resultados
                recent_over_35=stats["over_35"],
                justification=justification
            ))
    
    return teams_of_day

def analyze_matchups(matches: List[dict], standings: List[TeamStats], target_market: str) -> List[MatchupAnalysis]:
    """
    Analisa confrontos específicos com potencial para Over 3.5.
    """
    matchup_analyses = []
    
    # Criar índice de confrontos diretos (H2H)
    h2h_stats = defaultdict(lambda: {"total": 0, "over_35": 0})
    
    for match in matches:
        home_team = match.get("timeCasa", "Unknown")
        away_team = match.get("timeFora", "Unknown")
        total_goals = match.get("totalGolsFT", 0)
        
        h2h_key = f"{home_team}_vs_{away_team}"
        h2h_stats[h2h_key]["total"] += 1
        if total_goals > 3.5:
            h2h_stats[h2h_key]["over_35"] += 1
    
    # Analisar jogos com potencial Over 3.5
    for match in matches[-20:]:  # Últimos 20 jogos como exemplo
        home_team = match.get("timeCasa", "Unknown")
        away_team = match.get("timeFora", "Unknown")
        match_time = match.get("hour", "Unknown")
        total_goals = match.get("totalGolsFT", 0)
        
        # Buscar estatísticas dos times
        home_standing = next((t for t in standings if t.team_name == home_team), None)
        away_standing = next((t for t in standings if t.team_name == away_team), None)
        
        if not home_standing or not away_standing:
            continue
        
        # H2H
        h2h_key = f"{home_team}_vs_{away_team}"
        h2h = h2h_stats[h2h_key]
        
        # Determinar força
        home_strength = "Forte" if home_standing.over_35_rate >= 60 else "Médio" if home_standing.over_35_rate >= 40 else "Fraco"
        away_strength = "Forte" if away_standing.over_35_rate >= 60 else "Médio" if away_standing.over_35_rate >= 40 else "Fraco"
        
        # Previsão
        combined_rate = (home_standing.over_35_rate + away_standing.over_35_rate) / 2
        h2h_rate = (h2h["over_35"] / h2h["total"] * 100) if h2h["total"] > 0 else 0
        
        confidence = (combined_rate + h2h_rate) / 2 if h2h["total"] > 0 else combined_rate
        
        if confidence >= 60:
            prediction = "Over 3.5 provável"
        elif confidence >= 40:
            prediction = "Over 3.5 possível"
        else:
            prediction = "Over 3.5 improvável"
        
        matchup_analyses.append(MatchupAnalysis(
            home_team=home_team,
            away_team=away_team,
            match_time=match_time,
            home_position=home_standing.position,
            away_position=away_standing.position,
            h2h_total=h2h["total"],
            h2h_over_35=h2h["over_35"],
            home_over_35_season=home_standing.over_35_games,
            away_over_35_season=away_standing.over_35_games,
            home_strength=home_strength,
            away_strength=away_strength,
            prediction=prediction,
            confidence=round(confidence, 2)
        ))
    
    return matchup_analyses

def analyze_visual_patterns(matches: List[dict], target_market: str) -> MatrixMetrics:
    """
    Analisa padrões visuais criando uma matriz de resultados.
    """
    # Criar matriz: linhas = horários, colunas = minutos
    matrix = defaultdict(lambda: defaultdict(int))
    
    for match in matches:
        hour = match.get("hour", "")
        total_goals = match.get("totalGolsFT", 0)
        
        if not hour:
            continue
        
        # Extrair hora e minuto
        try:
            h, m = hour.split(":")
            h = int(h)
            m = int(m)
        except:
            continue
        
        # Marcar na matriz: 1 = Over 3.5, 0 = Under
        matrix[h][m] = 1 if total_goals > 3.5 else 0
    
    # Calcular métricas
    total_cells = 0
    green_cells = 0
    red_cells = 0
    
    for hour, minutes in matrix.items():
        for minute, value in minutes.items():
            total_cells += 1
            if value == 1:
                green_cells += 1
            else:
                red_cells += 1
    
    accuracy = (green_cells / total_cells * 100) if total_cells > 0 else 0
    
    # Detectar clusters
    clusters = detect_clusters(matrix)
    largest_cluster = max(clusters) if clusters else 0
    average_cluster = statistics.mean(clusters) if clusters else 0
    
    # Colunas mais quentes (minutos)
    minute_counts = defaultdict(lambda: {"green": 0, "total": 0})
    for hour, minutes in matrix.items():
        for minute, value in minutes.items():
            minute_counts[minute]["total"] += 1
            if value == 1:
                minute_counts[minute]["green"] += 1
    
    hottest_minutes = sorted(minute_counts.items(), key=lambda x: x[1]["green"] / x[1]["total"] if x[1]["total"] > 0 else 0, reverse=True)[:5]
    hottest_columns = [m for m, _ in hottest_minutes]
    
    coldest_minutes = sorted(minute_counts.items(), key=lambda x: x[1]["green"] / x[1]["total"] if x[1]["total"] > 0 else 0)[:5]
    coldest_columns = [m for m, _ in coldest_minutes]
    
    # Linhas mais quentes (horários)
    hour_counts = defaultdict(lambda: {"green": 0, "total": 0})
    for hour, minutes in matrix.items():
        for minute, value in minutes.items():
            hour_counts[hour]["total"] += 1
            if value == 1:
                hour_counts[hour]["green"] += 1
    
    hottest_hours = sorted(hour_counts.items(), key=lambda x: x[1]["green"] / x[1]["total"] if x[1]["total"] > 0 else 0, reverse=True)[:5]
    hottest_rows = [h for h, _ in hottest_hours]
    
    # Clusters verticais
    vertical_clusters = detect_vertical_clusters(matrix)
    
    # Resumo dos padrões
    pattern_summary = f"Acurácia geral: {accuracy:.1f}%. "
    if hottest_columns:
        pattern_summary += f"Minutos mais quentes: {', '.join(map(str, hottest_columns[:3]))}. "
    if hottest_rows:
        pattern_summary += f"Horários mais quentes: {', '.join(map(str, hottest_rows[:3]))}h. "
    pattern_summary += f"Maior cluster: {largest_cluster} células consecutivas."
    
    return MatrixMetrics(
        total_cells=total_cells,
        green_cells=green_cells,
        red_cells=red_cells,
        accuracy=round(accuracy, 2),
        largest_green_cluster=largest_cluster,
        average_cluster_size=round(average_cluster, 2),
        hottest_columns=hottest_columns,
        coldest_columns=coldest_columns,
        hottest_rows=hottest_rows,
        vertical_clusters=vertical_clusters,
        pattern_summary=pattern_summary
    )

def detect_clusters(matrix: Dict[int, Dict[int, int]]) -> List[int]:
    """Detecta clusters horizontais de células verdes."""
    clusters = []
    
    for hour in sorted(matrix.keys()):
        minutes = matrix[hour]
        current_cluster = 0
        
        for minute in sorted(minutes.keys()):
            if minutes[minute] == 1:
                current_cluster += 1
            else:
                if current_cluster > 0:
                    clusters.append(current_cluster)
                current_cluster = 0
        
        if current_cluster > 0:
            clusters.append(current_cluster)
    
    return clusters

def detect_vertical_clusters(matrix: Dict[int, Dict[int, int]]) -> List[Dict[str, Any]]:
    """Detecta clusters verticais (mesma coluna, linhas diferentes)."""
    # Reorganizar por minuto (coluna)
    by_minute = defaultdict(list)
    
    for hour in sorted(matrix.keys()):
        for minute in sorted(matrix[hour].keys()):
            by_minute[minute].append((hour, matrix[hour][minute]))
    
    vertical_clusters = []
    
    for minute, hour_values in by_minute.items():
        consecutive_greens = 0
        cluster_hours = []
        
        for hour, value in hour_values:
            if value == 1:
                consecutive_greens += 1
                cluster_hours.append(hour)
            else:
                if consecutive_greens >= 2:  # Cluster de pelo menos 2
                    vertical_clusters.append({
                        "minute": minute,
                        "size": consecutive_greens,
                        "hours": cluster_hours
                    })
                consecutive_greens = 0
                cluster_hours = []
        
        if consecutive_greens >= 2:
            vertical_clusters.append({
                "minute": minute,
                "size": consecutive_greens,
                "hours": cluster_hours
            })
    
    return vertical_clusters

def map_scenarios(matches: List[dict], target_market: str) -> ScenarioMapping:
    """
    Mapeia cenários: ODDs, placares, padrões temporais.
    """
    # Padrões de ODDs
    odds_data = defaultdict(lambda: {"total": 0, "over_35": 0})
    
    # Padrões de placares
    score_data = Counter()
    
    # Padrões temporais
    hour_data = defaultdict(lambda: {"total": 0, "over_35": 0})
    day_data = defaultdict(lambda: {"total": 0, "over_35": 0})
    
    for match in matches:
        total_goals = match.get("totalGolsFT", 0)
        hour = match.get("hour", "")
        date = match.get("date", "")
        home_goals = match.get("placarCasaFT", 0)
        away_goals = match.get("placarForaFT", 0)
        
        # ODDs (se disponível)
        # Assumindo que não temos ODDs nos dados, vamos simular baseado em gols
        
        # Placares
        if total_goals > 3.5:
            score_data[f"{home_goals}-{away_goals}"] += 1
        
        # Horários
        if hour:
            try:
                h = int(hour.split(":")[0])
                hour_data[h]["total"] += 1
                if total_goals > 3.5:
                    hour_data[h]["over_35"] += 1
            except:
                pass
        
        # Dias da semana
        if date:
            try:
                dt = datetime.strptime(date, "%Y-%m-%d")
                day_name = dt.strftime("%A")
                day_data[day_name]["total"] += 1
                if total_goals > 3.5:
                    day_data[day_name]["over_35"] += 1
            except:
                pass
    
    # Melhores ODDs (simulado)
    best_odds_range = {
        "min": 1.5,
        "max": 2.5,
        "average": 2.0,
        "note": "Dados de ODDs não disponíveis, valores simulados"
    }
    
    # Placares mais comuns
    common_scores = [{"score": score, "count": count} for score, count in score_data.most_common(10)]
    
    # Melhores horários
    best_hours_data = sorted(hour_data.items(), key=lambda x: x[1]["over_35"] / x[1]["total"] if x[1]["total"] > 0 else 0, reverse=True)[:5]
    best_hours = [f"{h}:00" for h, _ in best_hours_data]
    
    # Melhores dias
    best_days_data = sorted(day_data.items(), key=lambda x: x[1]["over_35"] / x[1]["total"] if x[1]["total"] > 0 else 0, reverse=True)[:3]
    best_days = [day for day, _ in best_days_data]
    
    # Sequências de sucesso (simplificado)
    success_sequences = ["3+ greens consecutivos", "Horário quente + Time forte", "H2H favorável"]
    
    return ScenarioMapping(
        best_odds_range=best_odds_range,
        common_scores=common_scores,
        best_hours=best_hours,
        best_days=best_days,
        success_sequences=success_sequences
    )

def generate_insights(standings: List[TeamStats], teams_of_day: List[TeamOfDay], 
                     matrix_metrics: MatrixMetrics, scenario_mapping: ScenarioMapping) -> List[str]:
    """Gera insights baseados nas análises."""
    insights = []
    
    # Insight 1: Time com melhor taxa de Over 3.5
    if standings:
        best_team = max(standings, key=lambda x: x.over_35_rate)
        insights.append(f"🏆 {best_team.team_name} tem a melhor taxa de Over 3.5: {best_team.over_35_rate:.1f}% ({best_team.over_35_games}/{best_team.total_games} jogos)")
    
    # Insight 2: Acurácia geral
    insights.append(f"📊 Acurácia geral da matriz: {matrix_metrics.accuracy:.1f}% ({matrix_metrics.green_cells}/{matrix_metrics.total_cells} células verdes)")
    
    # Insight 3: Horários quentes
    if matrix_metrics.hottest_rows:
        insights.append(f"🔥 Horários mais quentes: {', '.join(map(str, matrix_metrics.hottest_rows[:3]))}h")
    
    # Insight 4: Placares mais comuns
    if scenario_mapping.common_scores:
        top_scores = ', '.join([s["score"] for s in scenario_mapping.common_scores[:3]])
        insights.append(f"⚽ Placares mais comuns em Over 3.5: {top_scores}")
    
    # Insight 5: Clusters
    if matrix_metrics.largest_green_cluster > 0:
        insights.append(f"📈 Maior sequência de greens: {matrix_metrics.largest_green_cluster} células consecutivas")
    
    return insights

def generate_recommendations(matrix_metrics: MatrixMetrics, scenario_mapping: ScenarioMapping, 
                            standings: List[TeamStats]) -> List[str]:
    """Gera recomendações baseadas nas análises."""
    recommendations = []
    
    # Recomendação 1: Horários
    if scenario_mapping.best_hours:
        recommendations.append(f"✅ Priorize entradas nos horários: {', '.join(scenario_mapping.best_hours[:3])}")
    
    # Recomendação 2: Times
    if standings:
        top_3_teams = [t.team_name for t in standings[:3] if t.over_35_rate >= 50]
        if top_3_teams:
            recommendations.append(f"✅ Foque em jogos com: {', '.join(top_3_teams)}")
    
    # Recomendação 3: Acurácia
    if matrix_metrics.accuracy >= 60:
        recommendations.append(f"✅ Acurácia alta ({matrix_metrics.accuracy:.1f}%) - padrões consistentes detectados")
    else:
        recommendations.append(f"⚠️ Acurácia moderada ({matrix_metrics.accuracy:.1f}%) - use cautela e combine com outras análises")
    
    # Recomendação 4: Clusters verticais
    if matrix_metrics.vertical_clusters:
        recommendations.append(f"✅ {len(matrix_metrics.vertical_clusters)} clusters verticais detectados - observe minutos recorrentes")
    
    # Recomendação 5: Dias da semana
    if scenario_mapping.best_days:
        recommendations.append(f"✅ Melhores dias: {', '.join(scenario_mapping.best_days)}")
    
    return recommendations

