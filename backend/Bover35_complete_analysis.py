"""
over35_complete_analysis.py - Análise Completa Focada em Over 3.5

Implementa análise abrangente para o mercado Over 3.5, incluindo:
1. Tabela de classificação de times
2. Identificação do "Time do Dia"
3. Análise de confronto específico (H2H)
4. Análise de matriz visual de resultados
5. Mapeamento de cenários (ODDs, placares, padrões temporais)
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

class TeamOfTheDay(BaseModel):
    team_name: str
    over35_rate: float
    recent_over35_games: int  # Últimos N jogos
    recent_form: str  # Ex: "WWLWD"
    home_or_away: str  # "home" ou "away"
    justification: str

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
    team_of_the_day: Optional[TeamOfTheDay]
    match_analysis: Optional[MatchAnalysis]
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
            position=0  # Será calculado depois
        ))
    
    # Ordenar por pontos, depois saldo de gols
    standings.sort(key=lambda x: (x.points, x.goal_difference), reverse=True)
    
    # Atribuir posições
    for i, team in enumerate(standings, 1):
        team.position = i
    
    return standings

def identify_team_of_the_day(matches: List[dict], standings: List[TeamStats]) -> Optional[TeamOfTheDay]:
    """
    Identifica o time com maior viés para Over 3.5 no dia.
    """
    if len(matches) == 0:
        return None
    
    # Criar mapa de times para acesso rápido
    team_map = {team.team_name: team for team in standings}
    
    # Analisar últimos jogos de cada time (últimos 5)
    team_recent = defaultdict(lambda: {"over35": 0, "total": 0, "form": []})
    
    for match in matches[-20:]:  # Últimos 20 jogos
        home = match.get("timeCasa", "")
        away = match.get("timeFora", "")
        
        if home in team_map:
            team_recent[home]["total"] += 1
            if is_over35(match):
                team_recent[home]["over35"] += 1
            
            # Forma (W/L/D)
            home_goals = match.get("placarCasaFT", 0)
            away_goals = match.get("placarForaFT", 0)
            if home_goals > away_goals:
                team_recent[home]["form"].append("W")
            elif home_goals < away_goals:
                team_recent[home]["form"].append("L")
            else:
                team_recent[home]["form"].append("D")
        
        if away in team_map:
            team_recent[away]["total"] += 1
            if is_over35(match):
                team_recent[away]["over35"] += 1
            
            # Forma
            home_goals = match.get("placarCasaFT", 0)
            away_goals = match.get("placarForaFT", 0)
            if away_goals > home_goals:
                team_recent[away]["form"].append("W")
            elif away_goals < home_goals:
                team_recent[away]["form"].append("L")
            else:
                team_recent[away]["form"].append("D")
    
    # Encontrar time com melhor taxa recente de Over 3.5
    best_team = None
    best_rate = 0.0
    
    for team_name, data in team_recent.items():
        if data["total"] >= 3:  # Mínimo 3 jogos
            rate = (data["over35"] / data["total"]) if data["total"] > 0 else 0.0
            if rate > best_rate:
                best_rate = rate
                best_team = team_name
    
    if best_team is None:
        return None
    
    # Preparar resposta
    recent_data = team_recent[best_team]
    form_str = "".join(recent_data["form"][-5:])  # Últimos 5 resultados
    
    # Verificar se o time joga em casa ou fora no último jogo
    last_match = matches[-1]
    home_or_away = "home" if last_match.get("timeCasa") == best_team else "away"
    
    justification = (
        f"{best_team} teve Over 3.5 em {recent_data['over35']} dos últimos {recent_data['total']} jogos "
        f"({best_rate*100:.1f}% de taxa). Forma recente: {form_str}."
    )
    
    return TeamOfTheDay(
        team_name=best_team,
        over35_rate=best_rate * 100,
        recent_over35_games=recent_data["over35"],
        recent_form=form_str,
        home_or_away=home_or_away,
        justification=justification
    )

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
        else:  # home == team2
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
        
        # Usar hora como row e minuto como col (simplificado)
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
    Retorna: (horizontal_clusters, vertical_clusters)
    """
    if len(cells) == 0:
        return ([], [])
    
    # Separar células verdes
    green_cells = [c for c in cells if c.result == "green"]
    
    if len(green_cells) == 0:
        return ([], [])
    
    # Detectar clusters horizontais (mesma linha, colunas consecutivas)
    horizontal_clusters = []
    green_cells_sorted_by_row = sorted(green_cells, key=lambda x: (x.row, x.col))
    
    current_cluster = [green_cells_sorted_by_row[0]]
    for i in range(1, len(green_cells_sorted_by_row)):
        prev = green_cells_sorted_by_row[i-1]
        curr = green_cells_sorted_by_row[i]
        
        # Mesma linha e coluna próxima (diferença <= 5)
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
    
    # Adicionar último cluster
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
    
    # Detectar clusters verticais (mesma coluna, linhas diferentes)
    vertical_clusters = []
    green_cells_sorted_by_col = sorted(green_cells, key=lambda x: (x.col, x.row))
    
    current_cluster = [green_cells_sorted_by_col[0]]
    for i in range(1, len(green_cells_sorted_by_col)):
        prev = green_cells_sorted_by_col[i-1]
        curr = green_cells_sorted_by_col[i]
        
        # Mesma coluna e linha próxima (diferença <= 3)
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
    
    # Adicionar último cluster
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
    Analisa a matriz de resultados e retorna métricas.
    """
    total = len(cells)
    green_count = sum(1 for c in cells if c.result == "green")
    red_count = total - green_count
    accuracy = (green_count / total * 100) if total > 0 else 0.0
    
    # Detectar clusters
    horizontal_clusters, vertical_clusters = detect_clusters(cells)
    
    # Maior cluster
    all_clusters = horizontal_clusters + vertical_clusters
    largest_size = max([c.size for c in all_clusters]) if all_clusters else 0
    avg_size = sum([c.size for c in all_clusters]) / len(all_clusters) if all_clusters else 0.0
    
    # Colunas e linhas mais quentes
    col_counts = defaultdict(int)
    row_counts = defaultdict(int)
    
    for cell in cells:
        if cell.result == "green":
            col_counts[cell.col] += 1
            row_counts[cell.row] += 1
    
    hottest_cols = sorted(col_counts.keys(), key=lambda x: col_counts[x], reverse=True)[:5]
    coldest_cols = sorted(col_counts.keys(), key=lambda x: col_counts[x])[:5]
    hottest_rows = sorted(row_counts.keys(), key=lambda x: row_counts[x], reverse=True)[:5]
    
    # Resumo de padrões
    pattern_summary = (
        f"Encontrados {len(horizontal_clusters)} clusters horizontais e {len(vertical_clusters)} clusters verticais. "
        f"O maior cluster tem {largest_size} células consecutivas. "
        f"Colunas mais quentes: {hottest_cols}. "
        f"Linhas mais quentes: {hottest_rows}."
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
    Mapeia cenários favoráveis: ODDs, placares, horários.
    """
    over35_matches = [m for m in matches if is_over35(m)]
    
    # ODDs favoráveis
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
    
    # Placares comuns
    scores = [m.get("placarFT", "?-?") for m in over35_matches]
    score_counter = Counter(scores)
    common_scores = [
        {"score": score, "count": count, "percentage": (count / len(over35_matches) * 100) if over35_matches else 0}
        for score, count in score_counter.most_common(5)
    ]
    
    # Horários de pico
    hours = [m.get("hour", "00") for m in over35_matches]
    hour_counter = Counter(hours)
    # Garantir que peak_hours seja uma lista de strings
    peak_hours = [str(hour) for hour, _ in hour_counter.most_common(5)]
       
    
    # Sequências de sucesso/fracasso (simplificado)
    results = ["green" if is_over35(m) else "red" for m in matches]
    
    # Encontrar sequências de 3+ greens consecutivos
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
    
    # Encontrar sequências de 3+ reds consecutivos
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

# ==================== ENDPOINT PRINCIPAL ====================

class CompleteAnalysisRequest(BaseModel):
    date: str  # YYYY-MM-DD
    specific_match_time: Optional[str] = None  # HH:MM (opcional, para análise de confronto específico)

@over35_router.post("/complete-analysis", response_model=CompleteAnalysisResponse)
async def complete_analysis(request: CompleteAnalysisRequest):
    """
    Análise completa focada em Over 3.5:
    1. Tabela de classificação
    2. Time do dia
    3. Análise de confronto (se especificado)
    4. Matriz visual de resultados
    5. Mapeamento de cenários
    """
    try:
        db = await get_database()
        
        # Buscar todos os jogos do dia
        query = {"date": request.date}
        cursor = db.partidas.find(query).sort([("hour", 1), ("minute", 1)])
        matches = await cursor.to_list(length=None)
        
        if len(matches) == 0:
            raise HTTPException(
                status_code=404,
                detail=f"Nenhum jogo encontrado na data {request.date}"
            )
        
        # 1. Calcular tabela de classificação
        standings = calculate_standings(matches)
        
        # 2. Identificar time do dia
        team_of_day = identify_team_of_the_day(matches, standings)
        
        # 3. Análise de confronto específico (se solicitado)
        match_analysis = None
        if request.specific_match_time:
            # Encontrar o jogo específico
            specific_match = next(
                (m for m in matches if f"{m.get('hour')}:{m.get('minute')}" == request.specific_match_time),
                None
            )
            
            if specific_match:
                home = specific_match.get("timeCasa", "")
                away = specific_match.get("timeFora", "")
                
                # Buscar posições na tabela
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
        
        # 4. Construir e analisar matriz
        matrix_cells = build_matrix(matches)
        matrix_analysis = analyze_matrix(matrix_cells)
        
        # 5. Mapear cenários
        scenario_mapping = map_scenarios(matches)
        
        # Gerar insights
        insights = []
        insights.append(f"Total de {len(matches)} jogos analisados na data {request.date}")
        insights.append(f"Taxa geral de Over 3.5: {matrix_analysis.accuracy:.1f}%")
        
        if team_of_day:
            insights.append(f"Time do dia: {team_of_day.team_name} com {team_of_day.over35_rate:.1f}% de taxa recente")
        
        if len(matrix_analysis.horizontal_clusters) > 0:
            insights.append(f"Encontrados {len(matrix_analysis.horizontal_clusters)} clusters horizontais de sucesso")
        
        if len(matrix_analysis.vertical_clusters) > 0:
            insights.append(f"Encontrados {len(matrix_analysis.vertical_clusters)} clusters verticais (mesmo minuto, horários diferentes)")
        
        # Gerar recomendações
        recommendations = []
        
        if matrix_analysis.accuracy > 60:
            recommendations.append("⚠️ Alta taxa de Over 3.5 no dia - mercado favorável")
        elif matrix_analysis.accuracy < 30:
            recommendations.append("⚠️ Baixa taxa de Over 3.5 no dia - evitar esse mercado")
        
        if len(scenario_mapping.peak_hours) > 0:
            recommendations.append(f"Horários de pico: {', '.join(scenario_mapping.peak_hours)}")
        
        if len(scenario_mapping.success_sequences) > 0:
            recommendations.append(f"Sequências de sucesso detectadas: {len(scenario_mapping.success_sequences)} blocos")
        
        return CompleteAnalysisResponse(
            date=request.date,
            standings=standings,
            team_of_the_day=team_of_day,
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

