"""
efficient_pattern_analysis.py - Análise Eficiente de Padrões

Implementa análise focada em um mercado-alvo, varrendo jogos anteriores
e computando estatísticas de frequência de TODOS os mercados.

Exemplo de saída:
"O mercado Over 3.5 (odd 4.00) apareceu em 30% das partidas anteriores"
"O mercado Ambas Marcam (odd 1.98) apareceu em 60% das partidas anteriores"
"""

from fastapi import APIRouter, HTTPException
from typing import List, Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel
from database import get_database
from collections import defaultdict, Counter

efficient_pattern_router = APIRouter(prefix="/efficient-pattern", tags=["efficient-pattern"])

# ==================== MODELOS ====================

class EfficientPatternRequest(BaseModel):
    target_market: str  # Mercado-alvo (ex: "TotalGols_MaisDe_35")
    reference_date: str  # Data de referência (YYYY-MM-DD)
    lookback_games: int = 20  # Quantos jogos anteriores analisar

class MarketFrequency(BaseModel):
    market_name: str
    odd: float
    frequency: int  # Quantas vezes apareceu
    total_games: int  # Total de jogos analisados
    percentage: float  # Porcentagem de aparição
    result: str  # "green" (ganhou) ou "red" (perdeu) ou "both" (ambos)

class OccurrenceDetail(BaseModel):
    occurrence_index: int  # Índice da ocorrência (1, 2, 3...)
    target_game_time: str  # Horário do jogo onde o mercado-alvo ocorreu
    target_game_teams: str  # Times do jogo alvo
    target_game_score: str  # Placar do jogo alvo
    games_before: List[Dict[str, Any]]  # Lista dos N jogos anteriores
    market_frequencies: List[MarketFrequency]  # Frequências dos mercados nos jogos anteriores

class EfficientPatternResponse(BaseModel):
    date: str
    target_market: str
    target_market_odd: Optional[float]
    total_occurrences: int  # Quantas vezes o mercado-alvo ocorreu
    total_games_analyzed: int  # Total de jogos do dia
    
    # Estatísticas agregadas (considerando TODAS as ocorrências)
    aggregated_market_frequencies: List[MarketFrequency]
    
    # Detalhes de cada ocorrência
    occurrence_details: List[OccurrenceDetail]
    
    # Resumo
    summary: str
    recommendations: List[str]

# ==================== FUNÇÕES AUXILIARES ====================

def check_market_result(match: dict, market: str) -> str:
    """
    Verifica o resultado de um mercado específico no jogo.
    Retorna: "green" (ganhou), "red" (perdeu) ou "unknown"
    """
    placar_casa_ft = match.get("placarCasaFT", 0)
    placar_fora_ft = match.get("placarForaFT", 0)
    total_gols_ft = match.get("totalGolsFT", 0)
    
    # Total de Gols - Mais de X
    if "TotalGols_MaisDe_" in market:
        try:
            threshold = float(market.split("_")[-1].replace("5", ".5"))
            return "green" if total_gols_ft > threshold else "red"
        except:
            return "unknown"
    
    # Total de Gols - Menos de X
    if "TotalGols_MenosDe_" in market:
        try:
            threshold = float(market.split("_")[-1].replace("5", ".5"))
            return "green" if total_gols_ft < threshold else "red"
        except:
            return "unknown"
    
    # Vencedor FT
    if market == "VencedorFT_Casa":
        return "green" if placar_casa_ft > placar_fora_ft else "red"
    elif market == "VencedorFT_Empate":
        return "green" if placar_casa_ft == placar_fora_ft else "red"
    elif market == "VencedorFT_Visitante":
        return "green" if placar_casa_ft < placar_fora_ft else "red"
    
    # Ambas Marcam
    if market == "ParaOTimeMarcarSimNao_AmbasMarcam":
        return "green" if (placar_casa_ft > 0 and placar_fora_ft > 0) else "red"
    elif market == "ParaOTimeMarcarSimNao_ApenasCasa":
        return "green" if (placar_casa_ft > 0 and placar_fora_ft == 0) else "red"
    elif market == "ParaOTimeMarcarSimNao_ApenasFora":
        return "green" if (placar_casa_ft == 0 and placar_fora_ft > 0) else "red"
    elif market == "ParaOTimeMarcarSimNao_Nenhum":
        return "green" if (placar_casa_ft == 0 and placar_fora_ft == 0) else "red"
    
    return "unknown"

def extract_all_markets_with_odds(match: dict) -> List[Dict[str, Any]]:
    """
    Extrai TODOS os mercados de um jogo com suas odds fixas.
    Retorna lista de dicionários: [{"market": "TotalGols_MaisDe_25", "odd": 1.90, "result": "green"}, ...]
    """
    markets_data = match.get("markets", {})
    if not markets_data or not isinstance(markets_data, dict):
        return []
    
    all_markets = []
    
    for market_name, odd_value in markets_data.items():
        # Filtrar apenas mercados com odds numéricas
        if isinstance(odd_value, (int, float)) and odd_value > 0:
            result = check_market_result(match, market_name)
            all_markets.append({
                "market": market_name,
                "odd": float(odd_value),
                "result": result
            })
    
    return all_markets

def compute_market_frequencies(games: List[dict]) -> List[MarketFrequency]:
    """
    Computa a frequência de aparição de cada mercado nos jogos fornecidos.
    """
    market_counter = defaultdict(lambda: {"count": 0, "odds": [], "results": []})
    
    for game in games:
        markets = extract_all_markets_with_odds(game)
        for market_info in markets:
            market_name = market_info["market"]
            market_counter[market_name]["count"] += 1
            market_counter[market_name]["odds"].append(market_info["odd"])
            market_counter[market_name]["results"].append(market_info["result"])
    
    total_games = len(games)
    frequencies = []
    
    for market_name, data in market_counter.items():
        count = data["count"]
        odds = data["odds"]
        results = data["results"]
        
        # Usar a odd mais comum (moda)
        odd_counter = Counter(odds)
        most_common_odd = odd_counter.most_common(1)[0][0] if odd_counter else 0.0
        
        # Determinar resultado predominante
        result_counter = Counter(results)
        if "green" in result_counter and "red" in result_counter:
            result = "both"
        elif "green" in result_counter:
            result = "green"
        elif "red" in result_counter:
            result = "red"
        else:
            result = "unknown"
        
        frequencies.append(MarketFrequency(
            market_name=market_name,
            odd=most_common_odd,
            frequency=count,
            total_games=total_games,
            percentage=(count / total_games * 100) if total_games > 0 else 0.0,
            result=result
        ))
    
    # Ordenar por frequência (mais frequente primeiro)
    frequencies.sort(key=lambda x: x.frequency, reverse=True)
    
    return frequencies

# ==================== ENDPOINT PRINCIPAL ====================

@efficient_pattern_router.post("/analyze", response_model=EfficientPatternResponse)
async def analyze_efficient_pattern(request: EfficientPatternRequest):
    """
    Análise eficiente de padrões:
    
    1. Isola o mercado-alvo
    2. Encontra todas as ocorrências do mercado-alvo no dia
    3. Para cada ocorrência, varre os N jogos anteriores
    4. Armazena TODOS os mercados dos jogos anteriores com suas odds
    5. Computa estatísticas de frequência
    6. Apresenta: "Mercado X (odd Y) apareceu em Z% das partidas"
    """
    try:
        db = await get_database()
        
        # Buscar todos os jogos do dia, ordenados por horário
        query = {"date": request.reference_date}
        cursor = db.partidas.find(query).sort([("hour", 1), ("minute", 1)])
        matches = await cursor.to_list(length=None)
        
        if len(matches) == 0:
            raise HTTPException(
                status_code=404,
                detail=f"Nenhum jogo encontrado na data {request.reference_date}"
            )
        
        # Encontrar todas as ocorrências do mercado-alvo
        target_occurrences = []
        for i, match in enumerate(matches):
            result = check_market_result(match, request.target_market)
            if result == "green":
                target_occurrences.append({
                    "index": i,
                    "match": match
                })
        
        if len(target_occurrences) == 0:
            raise HTTPException(
                status_code=404,
                detail=f"O mercado {request.target_market} não ocorreu (ganhou) em nenhum jogo na data {request.reference_date}"
            )
        
        # Obter a odd do mercado-alvo (do primeiro jogo onde ocorreu)
        target_odd = None
        first_occurrence_markets = target_occurrences[0]["match"].get("markets", {})
        if request.target_market in first_occurrence_markets:
            target_odd = float(first_occurrence_markets[request.target_market])
        
        # Analisar cada ocorrência
        occurrence_details = []
        all_games_before = []  # Para estatísticas agregadas
        
        for occ_num, occurrence in enumerate(target_occurrences, 1):
            target_index = occurrence["index"]
            target_match = occurrence["match"]
            
            # Pegar os N jogos anteriores
            start_index = max(0, target_index - request.lookback_games)
            games_before = matches[start_index:target_index]
            
            if len(games_before) == 0:
                continue  # Não há jogos anteriores suficientes
            
            # Adicionar à lista agregada
            all_games_before.extend(games_before)
            
            # Computar frequências dos mercados nos jogos anteriores
            market_frequencies = compute_market_frequencies(games_before)
            
            # Preparar lista de jogos anteriores para exibição
            games_before_display = []
            for game in games_before:
                hour = game.get("hour", "")
                minute = game.get("minute", "")
                time_str = f"{hour}:{minute}" if hour and minute else "00:00"
                
                games_before_display.append({
                    "time": time_str,
                    "teams": f"{game.get('timeCasa', '?')} vs {game.get('timeFora', '?')}",
                    "score_ht": game.get("placarHT", "?-?"),
                    "score_ft": game.get("placarFT", "?-?"),
                    "total_goals": game.get("totalGolsFT", 0)
                })
            
            # Preparar informações do jogo alvo
            target_hour = target_match.get("hour", "")
            target_minute = target_match.get("minute", "")
            target_time = f"{target_hour}:{target_minute}" if target_hour and target_minute else "00:00"
            
            occurrence_details.append(OccurrenceDetail(
                occurrence_index=occ_num,
                target_game_time=target_time,
                target_game_teams=f"{target_match.get('timeCasa', '?')} vs {target_match.get('timeFora', '?')}",
                target_game_score=target_match.get("placarFT", "?-?"),
                games_before=games_before_display,
                market_frequencies=market_frequencies
            ))
        
        # Computar estatísticas agregadas (considerando TODOS os jogos anteriores de TODAS as ocorrências)
        aggregated_frequencies = compute_market_frequencies(all_games_before)
        
        # Gerar resumo
        top_3_markets = aggregated_frequencies[:3]
        summary_parts = []
        for mf in top_3_markets:
            summary_parts.append(
                f"{mf.market_name} (odd {mf.odd:.2f}) apareceu em {mf.percentage:.1f}% das partidas anteriores"
            )
        summary = " | ".join(summary_parts) if summary_parts else "Nenhum mercado encontrado"
        
        # Gerar recomendações
        recommendations = []
        recommendations.append(f"O mercado-alvo {request.target_market} ocorreu {len(target_occurrences)}x na data {request.reference_date}")
        recommendations.append(f"Total de {len(all_games_before)} jogos anteriores analisados (considerando todas as ocorrências)")
        
        if len(aggregated_frequencies) > 0:
            top_market = aggregated_frequencies[0]
            if top_market.percentage > 70:
                recommendations.append(f"⚠️ Mercado de alta frequência: {top_market.market_name} aparece em {top_market.percentage:.1f}% dos jogos anteriores")
            
            # Identificar mercados que sempre ganham
            always_green = [mf for mf in aggregated_frequencies if mf.result == "green" and mf.percentage > 50]
            if always_green:
                recommendations.append(f"✅ {len(always_green)} mercado(s) com alta taxa de sucesso (sempre 'green') nos jogos anteriores")
        
        return EfficientPatternResponse(
            date=request.reference_date,
            target_market=request.target_market,
            target_market_odd=target_odd,
            total_occurrences=len(target_occurrences),
            total_games_analyzed=len(matches),
            aggregated_market_frequencies=aggregated_frequencies,
            occurrence_details=occurrence_details,
            summary=summary,
            recommendations=recommendations
        )
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

