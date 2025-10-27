"""
over35_complete_analysis.py - Análise Completa Focada em Over 3.5

Implementa análise abrangente para o mercado Over 3.5, incluindo:
1. Tabela de classificação de times
2. Identificação do "Time do Dia" com análise automática de confrontos
3. Ranking Top 10 times do dia
4. Análise de confronto específico (H2H)
5. Análise de matriz visual de resultados
6. Mapeamento de cenários (ODDs, placares, padrões temporais)
"""

from fastapi import APIRouter, HTTPException
from typing import List, Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel
from database import get_database
from collections import defaultdict, Counter

over35_router = APIRouter(prefix="/over35-analysis", tags=["over35-analysis"])

# ==================== MODELOS ====================

class TeamStats(BaseModel):
    team_name: str
    points: int
    goal_difference: int
    total_wins: int
    total_losses: int
    total_draws: int
    home_wins: int
    away_wins: int
    over35_rate: float  # Porcentagem de jogos com 4+ gols
    over35_count: int  # Quantidade de jogos Over 3.5
    total_games: int
    position: int

class HeadToHead(BaseModel):
    team1: str
    team2: str
    total_matches: int
    team1_wins: int
    team2_wins: int
    draws: int
    over35_matches: int
    over35_rate: float
    common_scores: List[str]  # Ex: ["2-2", "3-1"]

class TeamMatchInfo(BaseModel):
    """Informação de um jogo específico do time"""
    match_time: str
    opponent: str
    is_home: bool
    score: str
    is_over35: bool
    h2h: HeadToHead

class TeamOfTheDay(BaseModel):
    team_name: str
    over35_rate: float
    over35_count: int  # Total de jogos Over 3.5 no dia
    total_games: int  # Total de jogos do time no dia
    recent_over35_games: int  # Últimos N jogos históricos
    recent_form: str  # Ex: "WWLWD"
    home_or_away: str  # "home", "away" ou "both"
    justification: str
    matches_today: List[TeamMatchInfo]  # NOVO: Todos os jogos do time no dia com H2H

class TeamRankingEntry(BaseModel):
    rank: int
    team_name: str
    over35_rate: float
    over35_count: int
    total_games: int
    recent_form: str

class TeamOfTheDayRanking(BaseModel):
    """Ranking completo de times do dia"""
    date: str
    top_teams: List[TeamRankingEntry]  # Top 10 times (resumido)

class MatchAnalysis(BaseModel):
    match_time: str
    team_home: str
    team_away: str
    team_home_position: int
    team_away_position: int
    team_home_over35_count: int
    team_away_over35_count: int
    head_to_head: HeadToHead
    recommendation: str

class MatrixCell(BaseModel):
    row: int  # Horário
    col: int  # Minuto/período
    result: str  # "green" ou "red"
    match_time: str
    teams: str
    score: str

class Cluster(BaseModel):
    cells: List[MatrixCell]
    size: int
    cluster_type: str  # "horizontal", "vertical", "block"
    start_row: int
    start_col: int
    end_row: int
    end_col: int

class MatrixAnalysis(BaseModel):
    total_cells: int
    green_cells: int
    red_cells: int
    accuracy: float
    largest_green_cluster: int
    average_cluster_size: float
    hottest_columns: List[int]
    coldest_columns: List[int]
    hottest_rows: List[int]
    vertical_clusters: List[Cluster]
    horizontal_clusters: List[Cluster]
    pattern_summary: str

class ScenarioMapping(BaseModel):
    favorable_odds: List[Dict[str, Any]]  # ODDs mais favoráveis
    common_scores: List[Dict[str, Any]]  # Placares mais comuns
    peak_hours: List[str]  # Horários com maior incidência
    success_sequences: List[str]  # Sequências de sucesso
    failure_sequences: List[str]  # Sequências de fracasso

class CompleteAnalysisResponse(BaseModel):
    date: str
    standings: List[TeamStats]
    team_of_the_day: Optional[TeamOfTheDay]  # TIME INVIESADO COM ANÁLISE COMPLETA
    ranking: TeamOfTheDayRanking  # TOP 10 RANKING
    match_analysis: Optional[MatchAnalysis]  # Análise de jogo específico (opcional)
    matrix_analysis: MatrixAnalysis
    scenario_mapping: ScenarioMapping
    insights: List[str]
    recommendations: List[str]

# ==================== FUNÇÕES AUXILIARES ====================

def is_over35(match: dict) -> bool:
    """Verifica se o jogo teve Over 3.5 (4+ gols)."""
    total_gols = match.get("totalGolsFT", 0)
    return total_gols >= 4

def calculate_standings(matches: List[dict]) -> List[TeamStats]:
    """
    Calcula a tabela de classificação de todos os times.
    """
    team_stats = defaultdict(lambda: {
        "points": 0,
        "goals_for": 0,
        "goals_against": 0,
        "wins": 0,
        "losses": 0,
        "draws": 0,
        "home_wins": 0,
        "away_wins": 0,
        "over35_count": 0,
        "total_games": 0
    })
    
    for match in matches:
        home = match.get("timeCasa", "Unknown")
        away = match.get("timeFora", "Unknown")
        home_goals = match.get("placarCasaFT", 0)
        away_goals = match.get("placarForaFT", 0)
        
        # Atualizar estatísticas
        team_stats[home]["total_games"] += 1
        team_stats[away]["total_games"] += 1
        
        team_stats[home]["goals_for"] += home_goals
        team_stats[home]["goals_against"] += away_goals
        team_stats[away]["goals_for"] += away_goals
        team_stats[away]["goals_against"] += home_goals
        
        # Resultado
        if home_goals > away_goals:
            team_stats[home]["wins"] += 1
            team_stats[home]["home_wins"] += 1
            team_stats[home]["points"] += 3
            team_stats[away]["losses"] += 1
        elif away_goals > home_goals:
            team_stats[away]["wins"] += 1
            team_stats[away]["away_wins"] += 1
            team_stats[away]["points"] += 3
            team_stats[home]["losses"] += 1
        else:
            team_stats[home]["draws"] += 1
            team_stats[away]["draws"] += 1
            team_stats[home]["points"] += 1
            team_stats[away]["points"] += 1
        
        # Over 3.5
        if is_over35(match):
            team_stats[home]["over35_count"] += 1
            team_stats[away]["over35_count"] += 1
    
    # Converter para lista de TeamStats
    standings = []
    for team_name, stats in team_stats.items():
        goal_diff = stats["goals_for"] - stats["goals_against"]
        over35_rate = (stats["over35_count"] / stats["total_games"] * 100) if stats["total_games"] > 0 else 0.0
        
        standings.append(TeamStats(
            team_name=team_name,
            points=stats["points"],
            goal_difference=goal_diff,
            total_wins=stats["wins"],
            total_losses=stats["losses"],
            total_draws=stats["draws"],
            home_wins=stats["home_wins"],
            away_wins=stats["away_wins"],
            over35_rate=over35_rate,
            over35_count=stats["over35_count"],
            total_games=stats["total_games"],
            position=0
        ))
    
    # Ordenar por pontos, depois saldo de gols
    standings.sort(key=lambda x: (x.points, x.goal_difference), reverse=True)
    
    # Atribuir posições
    for i, team in enumerate(standings, 1):
        team.position = i
    
    return standings

def analyze_head_to_head(matches: List[dict], team1: str, team2: str) -> HeadToHead:
    """
    Analisa o histórico de confrontos diretos entre dois times.
    """
    h2h_matches = [
        m for m in matches
        if (m.get("timeCasa") == team1 and m.get("timeFora") == team2) or
           (m.get("timeCasa") == team2 and m.get("timeFora") == team1)
    ]
    
    team1_wins = 0
    team2_wins = 0
    draws = 0
    over35_count = 0
    scores = []
    
    for match in h2h_matches:
        home = match.get("timeCasa")
        home_goals = match.get("placarCasaFT", 0)
        away_goals = match.get("placarForaFT", 0)
        
        scores.append(f"{home_goals}-{away_goals}")
        
        if is_over35(match):
            over35_count += 1
        
        if home == team1:
            if home_goals > away_goals:
                team1_wins += 1
            elif away_goals > home_goals:
                team2_wins += 1
            else:
                draws += 1
        else:
            if home_goals > away_goals:
                team2_wins += 1
            elif away_goals > home_goals:
                team1_wins += 1
            else:
                draws += 1
    
    # Placares mais comuns
    score_counter = Counter(scores)
    common_scores = [score for score, _ in score_counter.most_common(3)]
    
    total = len(h2h_matches)
    over35_rate = (over35_count / total * 100) if total > 0 else 0.0
    
    return HeadToHead(
        team1=team1,
        team2=team2,
        total_matches=total,
        team1_wins=team1_wins,
        team2_wins=team2_wins,
        draws=draws,
        over35_matches=over35_count,
        over35_rate=over35_rate,
        common_scores=common_scores
    )

def identify_team_of_the_day_complete(matches: List[dict], standings: List[TeamStats], date: str) -> tuple:
    """
    Identifica o time com maior viés para Over 3.5 no dia E cria ranking.
    Retorna: (team_of_the_day, ranking)
    """
    if len(matches) == 0:
        return (None, TeamOfTheDayRanking(date=date, top_teams=[]))
    
    # Criar mapa de times
    team_map = {team.team_name: team for team in standings}
    
    # Estrutura para análise
    team_analysis = defaultdict(lambda: {
        "over35_count": 0,
        "total_games": 0,
        "recent_over35": 0,
        "recent_total": 0,
        "form": [],
        "played_home": False,
        "played_away": False,
        "matches": []  # Armazena os jogos do time no dia
    })
    
    # ===== ANÁLISE DOS JOGOS DO DIA =====
    for match in matches:
        home = match.get("timeCasa", "")
        away = match.get("timeFora", "")
        is_over = is_over35(match)
        home_goals = match.get("placarCasaFT", 0)
        away_goals = match.get("placarForaFT", 0)
        
        # Time da casa
        if home and home in team_map:
            team_analysis[home]["total_games"] += 1
            team_analysis[home]["played_home"] = True
            team_analysis[home]["matches"].append({
                "match": match,
                "opponent": away,
                "is_home": True,
                "is_over35": is_over
            })
            
            if is_over:
                team_analysis[home]["over35_count"] += 1
            
            if home_goals > away_goals:
                team_analysis[home]["form"].append("W")
            elif home_goals < away_goals:
                team_analysis[home]["form"].append("L")
            else:
                team_analysis[home]["form"].append("D")
        
        # Time visitante
        if away and away in team_map:
            team_analysis[away]["total_games"] += 1
            team_analysis[away]["played_away"] = True
            team_analysis[away]["matches"].append({
                "match": match,
                "opponent": home,
                "is_home": False,
                "is_over35": is_over
            })
            
            if is_over:
                team_analysis[away]["over35_count"] += 1
            
            if away_goals > home_goals:
                team_analysis[away]["form"].append("W")
            elif away_goals < home_goals:
                team_analysis[away]["form"].append("L")
            else:
                team_analysis[away]["form"].append("D")
    
    # ===== ANÁLISE RECENTE (histórico) =====
    historical_limit = max(0, len(matches) - 50)
    for match in matches[historical_limit:]:
        home = match.get("timeCasa", "")
        away = match.get("timeFora", "")
        is_over = is_over35(match)
        
        if home in team_analysis and team_analysis[home]["recent_total"] < 5:
            team_analysis[home]["recent_total"] += 1
            if is_over:
                team_analysis[home]["recent_over35"] += 1
        
        if away in team_analysis and team_analysis[away]["recent_total"] < 5:
            team_analysis[away]["recent_total"] += 1
            if is_over:
                team_analysis[away]["recent_over35"] += 1
    
    # ===== CRIAR RANKING =====
    team_scores = []
    
    for team_name, data in team_analysis.items():
        if data["total_games"] == 0:
            continue
        
        over35_rate = (data["over35_count"] / data["total_games"] * 100) if data["total_games"] > 0 else 0.0
        form_str = "".join(data["form"][-5:]) if data["form"] else "N/A"
        
        team_scores.append({
            "team_name": team_name,
            "over35_count": data["over35_count"],
            "over35_rate": over35_rate,
            "total_games": data["total_games"],
            "recent_over35": data["recent_over35"],
            "recent_total": data["recent_total"],
            "form": form_str,
            "played_home": data["played_home"],
            "played_away": data["played_away"],
            "matches": data["matches"]
        })
    
    # Ordenar por over35_count (prioridade) e depois por taxa
    team_scores.sort(key=lambda x: (x["over35_count"], x["over35_rate"]), reverse=True)
    
    # ===== CRIAR TOP 10 RANKING =====
    ranking_entries = []
    for rank, team_data in enumerate(team_scores[:10], 1):
        ranking_entries.append(TeamRankingEntry(
            rank=rank,
            team_name=team_data["team_name"],
            over35_rate=team_data["over35_rate"],
            over35_count=team_data["over35_count"],
            total_games=team_data["total_games"],
            recent_form=team_data["form"]
        ))
    
    ranking = TeamOfTheDayRanking(date=date, top_teams=ranking_entries)
    
    # ===== CRIAR TIME DO DIA (melhor time com análise completa) =====
    if len(team_scores) == 0:
        return (None, ranking)
    
    best = team_scores[0]
    
    # Determinar local
    if best["played_home"] and best["played_away"]:
        location = "both"
    elif best["played_home"]:
        location = "home"
    else:
        location = "away"
    
    # Criar análise H2H para cada jogo do time
    matches_info = []
    for match_data in best["matches"]:
        match = match_data["match"]
        opponent = match_data["opponent"]
        is_home = match_data["is_home"]
        
        h2h = analyze_head_to_head(matches, best["team_name"], opponent)
        
        hour = match.get("hour", "00")
        minute = match.get("minute", "00")
        score = match.get("placarFT", "?-?")
        
        matches_info.append(TeamMatchInfo(
            match_time=f"{hour}:{minute}",
            opponent=opponent,
            is_home=is_home,
            score=score,
            is_over35=match_data["is_over35"],
            h2h=h2h
        ))
    
    # Justificativa
    recent_rate = (best["recent_over35"] / best["recent_total"] * 100) if best["recent_total"] > 0 else 0.0
    justification = (
        f"🏆 {best['team_name']} é o time mais inviesado para Over 3.5 hoje!\n\n"
        f"📊 Performance no dia:\n"
        f"- {best['over35_count']} Over 3.5 em {best['total_games']} jogo(s) ({best['over35_rate']:.1f}%)\n"
        f"- Forma recente: {best['form']}\n"
        f"- Histórico: {best['recent_over35']}/{best['recent_total']} Over 3.5 ({recent_rate:.1f}%)\n"
        f"- Jogou como: {location}\n\n"
        f"⚽ Análise detalhada dos confrontos abaixo."
    )
    
    team_of_day = TeamOfTheDay(
        team_name=best["team_name"],
        over35_rate=best["over35_rate"],
        over35_count=best["over35_count"],
        total_games=best["total_games"],
        recent_over35_games=best["recent_over35"],
        recent_form=best["form"],
        home_or_away=location,
        justification=justification,
        matches_today=matches_info
    )
    
    return (team_of_day, ranking)

def build_matrix(matches: List[dict]) -> List[MatrixCell]:
    """
    Constrói uma matriz de resultados onde cada célula representa um jogo.
    """
    cells = []
    
    for i, match in enumerate(matches):
        hour = match.get("hour", "00")
        minute = match.get("minute", "00")
        time_str = f"{hour}:{minute}"
        
        home = match.get("timeCasa", "?")
        away = match.get("timeFora", "?")
        teams_str = f"{home} vs {away}"
        
        score_ft = match.get("placarFT", "?-?")
        
        result = "green" if is_over35(match) else "red"
        
        try:
            row = int(hour)
            col = int(minute)
        except:
            row = 0
            col = 0
        
        cells.append(MatrixCell(
            row=row,
            col=col,
            result=result,
            match_time=time_str,
            teams=teams_str,
            score=score_ft
        ))
    
    return cells

def detect_clusters(cells: List[MatrixCell]) -> tuple:
    """
    Detecta clusters (agrupamentos) de células verdes.
    """
    if len(cells) == 0:
        return ([], [])
    
    green_cells = [c for c in cells if c.result == "green"]
    
    if len(green_cells) == 0:
        return ([], [])
    
    # Clusters horizontais
    horizontal_clusters = []
    green_cells_sorted_by_row = sorted(green_cells, key=lambda x: (x.row, x.col))
    
    current_cluster = [green_cells_sorted_by_row[0]]
    for i in range(1, len(green_cells_sorted_by_row)):
        prev = green_cells_sorted_by_row[i-1]
        curr = green_cells_sorted_by_row[i]
        
        if curr.row == prev.row and abs(curr.col - prev.col) <= 5:
            current_cluster.append(curr)
        else:
            if len(current_cluster) >= 2:
                horizontal_clusters.append(Cluster(
                    cells=current_cluster,
                    size=len(current_cluster),
                    cluster_type="horizontal",
                    start_row=current_cluster[0].row,
                    start_col=current_cluster[0].col,
                    end_row=current_cluster[-1].row,
                    end_col=current_cluster[-1].col
                ))
            current_cluster = [curr]
    
    if len(current_cluster) >= 2:
        horizontal_clusters.append(Cluster(
            cells=current_cluster,
            size=len(current_cluster),
            cluster_type="horizontal",
            start_row=current_cluster[0].row,
            start_col=current_cluster[0].col,
            end_row=current_cluster[-1].row,
            end_col=current_cluster[-1].col
        ))
    
    # Clusters verticais
    vertical_clusters = []
    green_cells_sorted_by_col = sorted(green_cells, key=lambda x: (x.col, x.row))
    
    current_cluster = [green_cells_sorted_by_col[0]]
    for i in range(1, len(green_cells_sorted_by_col)):
        prev = green_cells_sorted_by_col[i-1]
        curr = green_cells_sorted_by_col[i]
        
        if curr.col == prev.col and abs(curr.row - prev.row) <= 3:
            current_cluster.append(curr)
        else:
            if len(current_cluster) >= 2:
                vertical_clusters.append(Cluster(
                    cells=current_cluster,
                    size=len(current_cluster),
                    cluster_type="vertical",
                    start_row=current_cluster[0].row,
                    start_col=current_cluster[0].col,
                    end_row=current_cluster[-1].row,
                    end_col=current_cluster[-1].col
                ))
            current_cluster = [curr]
    
    if len(current_cluster) >= 2:
        vertical_clusters.append(Cluster(
            cells=current_cluster,
            size=len(current_cluster),
            cluster_type="vertical",
            start_row=current_cluster[0].row,
            start_col=current_cluster[0].col,
            end_row=current_cluster[-1].row,
            end_col=current_cluster[-1].col
        ))
    
    return (horizontal_clusters, vertical_clusters)

def analyze_matrix(cells: List[MatrixCell]) -> MatrixAnalysis:
    """
    Analisa a matriz de resultados.
    """
    total = len(cells)
    green_count = sum(1 for c in cells if c.result == "green")
    red_count = total - green_count
    accuracy = (green_count / total * 100) if total > 0 else 0.0
    
    horizontal_clusters, vertical_clusters = detect_clusters(cells)
    
    all_clusters = horizontal_clusters + vertical_clusters
    largest_size = max([c.size for c in all_clusters]) if all_clusters else 0
    avg_size = sum([c.size for c in all_clusters]) / len(all_clusters) if all_clusters else 0.0
    
    col_counts = defaultdict(int)
    row_counts = defaultdict(int)
    
    for cell in cells:
        if cell.result == "green":
            col_counts[cell.col] += 1
            row_counts[cell.row] += 1
    
    hottest_cols = sorted(col_counts.keys(), key=lambda x: col_counts[x], reverse=True)[:5]
    coldest_cols = sorted(col_counts.keys(), key=lambda x: col_counts[x])[:5]
    hottest_rows = sorted(row_counts.keys(), key=lambda x: row_counts[x], reverse=True)[:5]
    
    pattern_summary = (
        f"Encontrados {len(horizontal_clusters)} clusters horizontais e {len(vertical_clusters)} clusters verticais. "
        f"O maior cluster tem {largest_size} células consecutivas."
    )
    
    return MatrixAnalysis(
        total_cells=total,
        green_cells=green_count,
        red_cells=red_count,
        accuracy=accuracy,
        largest_green_cluster=largest_size,
        average_cluster_size=avg_size,
        hottest_columns=hottest_cols,
        coldest_columns=coldest_cols,
        hottest_rows=hottest_rows,
        vertical_clusters=vertical_clusters,
        horizontal_clusters=horizontal_clusters,
        pattern_summary=pattern_summary
    )

def map_scenarios(matches: List[dict]) -> ScenarioMapping:
    """
    Mapeia cenários favoráveis.
    """
    over35_matches = [m for m in matches if is_over35(m)]
    
    # ODDs
    odds_list = []
    for match in over35_matches:
        markets = match.get("markets", {})
        over35_odd = markets.get("TotalGols_MaisDe_35", None)
        if over35_odd and isinstance(over35_odd, (int, float)):
            odds_list.append(float(over35_odd))
    
    odd_counter = Counter(odds_list)
    favorable_odds = [
        {"odd": odd, "count": count, "percentage": (count / len(over35_matches) * 100) if over35_matches else 0}
        for odd, count in odd_counter.most_common(5)
    ]
    
    # Placares
    scores = [m.get("placarFT", "?-?") for m in over35_matches]
    score_counter = Counter(scores)
    common_scores = [
        {"score": score, "count": count, "percentage": (count / len(over35_matches) * 100) if over35_matches else 0}
        for score, count in score_counter.most_common(5)
    ]
    
    # Horários - CORRIGIDO
    hours = [m.get("hour", "00") for m in over35_matches]
    hour_counter = Counter(hours)
    peak_hours = [str(hour) for hour, _ in hour_counter.most_common(5)]
    
    # Sequências
    results = ["green" if is_over35(m) else "red" for m in matches]
    
    success_sequences = []
    current_seq = []
    for r in results:
        if r == "green":
            current_seq.append(r)
        else:
            if len(current_seq) >= 3:
                success_sequences.append("".join(current_seq))
            current_seq = []
    if len(current_seq) >= 3:
        success_sequences.append("".join(current_seq))
    
    failure_sequences = []
    current_seq = []
    for r in results:
        if r == "red":
            current_seq.append(r)
        else:
            if len(current_seq) >= 3:
                failure_sequences.append("".join(current_seq))
            current_seq = []
    if len(current_seq) >= 3:
        failure_sequences.append("".join(current_seq))
    
    return ScenarioMapping(
        favorable_odds=favorable_odds,
        common_scores=common_scores,
        peak_hours=peak_hours,
        success_sequences=success_sequences[:5],
        failure_sequences=failure_sequences[:5]
    )

# ==================== ENDPOINT ====================

class CompleteAnalysisRequest(BaseModel):
    date: str
    specific_match_time: Optional[str] = None

@over35_router.post("/complete-analysis", response_model=CompleteAnalysisResponse)
async def complete_analysis(request: CompleteAnalysisRequest):
    """
    Análise completa Over 3.5 com Time do Dia inviesado + ranking
    """
    try:
        db = await get_database()
        
        query = {"date": request.date}
        cursor = db.partidas.find(query).sort([("hour", 1), ("minute", 1)])
        matches = await cursor.to_list(length=None)
        
        if len(matches) == 0:
            raise HTTPException(status_code=404, detail=f"Nenhum jogo encontrado na data {request.date}")
        
        # 1. Classificação
        standings = calculate_standings(matches)
        
        # 2. Time do Dia + Ranking
        team_of_day, ranking = identify_team_of_the_day_complete(matches, standings, request.date)
        
        # 3. Análise de confronto específico (opcional)
        match_analysis = None
        if request.specific_match_time:
            specific_match = next(
                (m for m in matches if f"{m.get('hour')}:{m.get('minute')}" == request.specific_match_time),
                None
            )
            
            if specific_match:
                home = specific_match.get("timeCasa", "")
                away = specific_match.get("timeFora", "")
                
                home_team = next((t for t in standings if t.team_name == home), None)
                away_team = next((t for t in standings if t.team_name == away), None)
                
                if home_team and away_team:
                    h2h = analyze_head_to_head(matches, home, away)
                    
                    recommendation = (
                        f"Over 3.5: {h2h.over35_rate:.1f}% em confrontos diretos. "
                        f"{home} ({home_team.over35_count} Over 3.5) vs {away} ({away_team.over35_count} Over 3.5)."
                    )
                    
                    match_analysis = MatchAnalysis(
                        match_time=request.specific_match_time,
                        team_home=home,
                        team_away=away,
                        team_home_position=home_team.position,
                        team_away_position=away_team.position,
                        team_home_over35_count=home_team.over35_count,
                        team_away_over35_count=away_team.over35_count,
                        head_to_head=h2h,
                        recommendation=recommendation
                    )
        
        # 4. Matriz
        matrix_cells = build_matrix(matches)
        matrix_analysis = analyze_matrix(matrix_cells)
        
        # 5. Cenários
        scenario_mapping = map_scenarios(matches)
        
        # 6. Insights
        insights = []
        insights.append(f"📅 Total de {len(matches)} jogos analisados na data {request.date}")
        insights.append(f"📊 Taxa geral de Over 3.5: {matrix_analysis.accuracy:.1f}%")
        
        if team_of_day:
            insights.append(
                f"🏆 Time mais inviesado: {team_of_day.team_name} com {team_of_day.over35_count} Over 3.5 "
                f"em {team_of_day.total_games} jogo(s) ({team_of_day.over35_rate:.1f}%)"
            )
            insights.append(f"⚽ {team_of_day.team_name} teve {len(team_of_day.matches_today)} confronto(s) analisados hoje")
        
        if len(matrix_analysis.horizontal_clusters) > 0:
            insights.append(f"🔥 {len(matrix_analysis.horizontal_clusters)} clusters horizontais detectados")
        
        if len(matrix_analysis.vertical_clusters) > 0:
            insights.append(f"📈 {len(matrix_analysis.vertical_clusters)} clusters verticais detectados")
        
        # 7. Recomendações
        recommendations = []
        
        if matrix_analysis.accuracy > 60:
            recommendations.append("✅ Alta taxa de Over 3.5 - mercado muito favorável hoje")
        elif matrix_analysis.accuracy < 30:
            recommendations.append("⚠️ Baixa taxa de Over 3.5 - evitar esse mercado hoje")
        else:
            recommendations.append("🔄 Taxa moderada de Over 3.5 - analisar confrontos específicos")
        
        if len(scenario_mapping.peak_hours) > 0:
            recommendations.append(f"🕐 Horários de maior sucesso: {', '.join(scenario_mapping.peak_hours)}h")
        
        if team_of_day and len(team_of_day.matches_today) > 0:
            recommendations.append(f"⭐ Foco no {team_of_day.team_name} - veja análise H2H detalhada dos confrontos")
        
        if len(ranking.top_teams) >= 3:
            top3_names = ", ".join([t.team_name for t in ranking.top_teams[:3]])
            recommendations.append(f"🥇 Top 3 times: {top3_names}")
        
        if len(scenario_mapping.success_sequences) > 0:
            recommendations.append(f"📊 {len(scenario_mapping.success_sequences)} sequências de sucesso identificadas")
        
        return CompleteAnalysisResponse(
            date=request.date,
            standings=standings,
            team_of_the_day=team_of_day,
            ranking=ranking,
            match_analysis=match_analysis,
            matrix_analysis=matrix_analysis,
            scenario_mapping=scenario_mapping,
            insights=insights,
            recommendations=recommendations
        )
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))