"""
advanced_sequential_analysis.py - Análise Sequencial Avançada

Implementa análise diária de padrões sequenciais para um mercado-alvo,
incluindo:
- Análise temporal (distribuição por hora)
- Sequências dos N jogos anteriores
- Todos os mercados (não apenas os que ganharam)
- Odds fixas por mercado
- Detecção de clusters temporais
- Combinações de mercados recorrentes
"""

from fastapi import APIRouter, HTTPException
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from pydantic import BaseModel
from database import get_database
from collections import Counter, defaultdict

advanced_analysis_router = APIRouter(prefix="/advanced-analysis", tags=["advanced-analysis"])

# ==================== MODELOS ====================

class SequentialAnalysisRequest(BaseModel):
    target_market: str  # Mercado-alvo (ex: "TotalGols_MaisDe_25")
    reference_date: str  # Data de referência (YYYY-MM-DD)
    lookback_games: int = 20  # Quantos jogos anteriores analisar

class HourlyDistribution(BaseModel):
    hour: int
    occurrences: int
    percentage: float

class ScoreSequence(BaseModel):
    sequence: List[str]  # Ex: ["1-1", "2-3", "1-3"]
    frequency: int
    percentage: float

class MarketCombination(BaseModel):
    market_name: str
    odd: float
    frequency: int
    percentage: float

class TemporalCluster(BaseModel):
    start_time: str  # HH:MM
    end_time: str  # HH:MM
    games: List[Dict[str, Any]]  # Lista de jogos no cluster
    market_frequency: Dict[str, int]  # Frequência de cada mercado no cluster

class SequentialPattern(BaseModel):
    pattern_description: str
    games_before: List[Dict[str, Any]]  # N jogos anteriores
    target_game: Dict[str, Any]  # Jogo onde o mercado-alvo ocorreu
    score_sequence_ht: List[str]
    score_sequence_ft: List[str]
    market_combinations: List[MarketCombination]

class AdvancedSequentialAnalysisResponse(BaseModel):
    date: str
    target_market: str
    target_market_odd: Optional[float]
    total_occurrences: int
    hourly_distribution: List[HourlyDistribution]
    top_score_sequences_ht: List[ScoreSequence]
    top_score_sequences_ft: List[ScoreSequence]
    top_market_combinations: List[MarketCombination]
    temporal_clusters: List[TemporalCluster]
    sequential_patterns: List[SequentialPattern]
    recommendations: List[str]

# ==================== FUNÇÕES AUXILIARES ====================

def clean_mongo_doc(doc: dict) -> dict:
    """
    Remove campos do MongoDB que não são serializáveis (como _id).
    Retorna uma cópia limpa do documento.
    """
    if doc is None:
        return {}
    clean_doc = {k: v for k, v in doc.items() if k != '_id'}
    return clean_doc

def parse_time(time_str: str) -> datetime:
    """Converte string HH:MM para datetime."""
    try:
        return datetime.strptime(time_str, "%H:%M")
    except:
        return None

def get_fixed_odd(market_name: str, markets_data: dict) -> Optional[float]:
    """
    Retorna a odd fixa de um mercado.
    Como as odds são fixas, basta pegar o valor do mercado.
    """
    if market_name in markets_data:
        value = markets_data[market_name]
        if isinstance(value, (int, float)):
            return float(value)
    return None

def check_market_occurred(match: dict, market: str) -> bool:
    """
    Verifica se um mercado específico ocorreu (ganhou) no jogo.
    Usa a mesma lógica de check_market_result do analysis_routes.py
    """
    placar_casa_ft = match.get("placarCasaFT", 0)
    placar_fora_ft = match.get("placarForaFT", 0)
    total_gols_ft = match.get("totalGolsFT", 0)
    
    # Total de Gols - Mais de X
    if "TotalGols_MaisDe_" in market:
        try:
            threshold = float(market.split("_")[-1].replace("5", ".5"))
            return total_gols_ft > threshold
        except:
            pass
    
    # Total de Gols - Menos de X
    if "TotalGols_MenosDe_" in market:
        try:
            threshold = float(market.split("_")[-1].replace("5", ".5"))
            return total_gols_ft < threshold
        except:
            pass
    
    # Vencedor FT
    if market == "VencedorFT_Casa":
        return placar_casa_ft > placar_fora_ft
    elif market == "VencedorFT_Empate":
        return placar_casa_ft == placar_fora_ft
    elif market == "VencedorFT_Visitante":
        return placar_casa_ft < placar_fora_ft
    
    # Ambas Marcam
    if market == "ParaOTimeMarcarSimNao_AmbasMarcam":
        return placar_casa_ft > 0 and placar_fora_ft > 0
    elif market == "ParaOTimeMarcarSimNao_NenhumaMarca":
        return placar_casa_ft == 0 and placar_fora_ft == 0
    
    # Gols Exatos
    if "GolsExatos_" in market:
        try:
            exact_goals = int(market.split("_")[-1])
            return total_gols_ft == exact_goals
        except:
            pass
    
    return False

def detect_temporal_clusters(matches: List[dict], time_window_minutes: int = 120) -> List[TemporalCluster]:
    """
    Detecta clusters temporais: grupos de jogos que ocorreram em sequência
    dentro de uma janela de tempo (padrão: 2 horas).
    """
    clusters = []
    
    # Ordenar jogos por horário (usar hour e minute)
    def get_time_key(match):
        hour = match.get("hour", "00")
        minute = match.get("minute", "00")
        return f"{hour}:{minute}"
    
    sorted_matches = sorted(matches, key=get_time_key)
    
    if len(sorted_matches) < 2:
        return clusters
    
    current_cluster = [sorted_matches[0]]
    
    for i in range(1, len(sorted_matches)):
        prev_match = sorted_matches[i-1]
        curr_match = sorted_matches[i]
        prev_time_str = f"{prev_match.get('hour', '00')}:{prev_match.get('minute', '00')}"
        curr_time_str = f"{curr_match.get('hour', '00')}:{curr_match.get('minute', '00')}"
        prev_time = parse_time(prev_time_str)
        curr_time = parse_time(curr_time_str)
        
        if prev_time and curr_time:
            time_diff = (curr_time - prev_time).total_seconds() / 60  # minutos
            
            if time_diff <= time_window_minutes:
                current_cluster.append(sorted_matches[i])
            else:
                # Salvar cluster se tiver 2+ jogos
                if len(current_cluster) >= 2:
                    # Contar frequência de mercados no cluster
                    market_freq = defaultdict(int)
                    for match in current_cluster:
                        if "markets" in match:
                            for market_name, market_value in match["markets"].items():
                                if isinstance(market_value, (int, float)):
                                    if check_market_occurred(match, market_name):
                                        market_freq[market_name] += 1
                    
                    start_match = current_cluster[0]
                    end_match = current_cluster[-1]
                    start_time_str = f"{start_match.get('hour', '00')}:{start_match.get('minute', '00')}"
                    end_time_str = f"{end_match.get('hour', '00')}:{end_match.get('minute', '00')}"
                    
                    clusters.append(TemporalCluster(
                        start_time=start_time_str,
                        end_time=end_time_str,
                        games=[clean_mongo_doc(m) for m in current_cluster],
                        market_frequency=dict(market_freq)
                    ))
                
                # Iniciar novo cluster
                current_cluster = [sorted_matches[i]]
    
    # Adicionar último cluster se tiver 2+ jogos
    if len(current_cluster) >= 2:
        market_freq = defaultdict(int)
        for match in current_cluster:
            if "markets" in match:
                for market_name, market_value in match["markets"].items():
                    if isinstance(market_value, (int, float)):
                        if check_market_occurred(match, market_name):
                            market_freq[market_name] += 1
        
        start_match = current_cluster[0]
        end_match = current_cluster[-1]
        start_time_str = f"{start_match.get('hour', '00')}:{start_match.get('minute', '00')}"
        end_time_str = f"{end_match.get('hour', '00')}:{end_match.get('minute', '00')}"
        
        clusters.append(TemporalCluster(
            start_time=start_time_str,
            end_time=end_time_str,
            games=[clean_mongo_doc(m) for m in current_cluster],
            market_frequency=dict(market_freq)
        ))
    
    return clusters

# ==================== ENDPOINT PRINCIPAL ====================

@advanced_analysis_router.post("/sequential-patterns", response_model=AdvancedSequentialAnalysisResponse)
async def analyze_sequential_patterns(request: SequentialAnalysisRequest):
    """
    Realiza análise sequencial avançada para um mercado-alvo em uma data específica.
    
    Para cada ocorrência do mercado-alvo:
    1. Identifica os N jogos anteriores
    2. Analisa placares HT/FT desses jogos
    3. Identifica todos os mercados disponíveis (com odds fixas)
    4. Detecta padrões e combinações recorrentes
    5. Identifica clusters temporais
    """
    try:
        db = await get_database()
        
        # Buscar todos os jogos da data de referência
        query = {"date": request.reference_date}
        cursor = db.partidas.find(query).sort("hour", 1)  # Ordenar por hora
        all_matches = await cursor.to_list(length=None)
        
        if not all_matches:
            raise HTTPException(status_code=404, detail=f"Nenhum jogo encontrado na data {request.reference_date}")
        
        # Filtrar jogos onde o mercado-alvo ocorreu
        target_occurrences = []
        for i, match in enumerate(all_matches):
            if check_market_occurred(match, request.target_market):
                target_occurrences.append({
                    "index": i,
                    "match": match
                })
        
        if not target_occurrences:
            raise HTTPException(status_code=404, detail=f"Mercado {request.target_market} não ocorreu na data {request.reference_date}")
        
        # Obter odd fixa do mercado-alvo (do primeiro jogo)
        target_market_odd = None
        if all_matches[0].get("markets"):
            target_market_odd = get_fixed_odd(request.target_market, all_matches[0]["markets"])
        
        # ==================== ANÁLISE TEMPORAL ====================
        
        hourly_counts = defaultdict(int)
        for occurrence in target_occurrences:
            hour_str = occurrence["match"].get("hour", "00")
            try:
                hour = int(hour_str)
            except:
                hour = 0
            hourly_counts[hour] += 1
        
        total_occurrences = len(target_occurrences)
        hourly_distribution = [
            HourlyDistribution(
                hour=hour,
                occurrences=count,
                percentage=(count / total_occurrences * 100) if total_occurrences > 0 else 0
            )
            for hour, count in sorted(hourly_counts.items())
        ]
        
        # ==================== ANÁLISE SEQUENCIAL ====================
        
        all_score_sequences_ht = []
        all_score_sequences_ft = []
        all_market_combinations = []
        sequential_patterns = []
        
        for occurrence in target_occurrences:
            index = occurrence["index"]
            target_game = occurrence["match"]
            
            # Pegar N jogos anteriores
            start_index = max(0, index - request.lookback_games)
            games_before = all_matches[start_index:index]
            
            if len(games_before) == 0:
                continue
            
            # Extrair sequências de placares HT
            score_seq_ht = [g.get("placarHT", "?-?") for g in games_before]
            all_score_sequences_ht.append(tuple(score_seq_ht))
            
            # Extrair sequências de placares FT
            score_seq_ft = [g.get("placarFT", "?-?") for g in games_before]
            all_score_sequences_ft.append(tuple(score_seq_ft))
            
            # Extrair combinações de mercados (todos os mercados, com odds fixas)
            market_combs = []
            for game in games_before:
                if "markets" in game:
                    for market_name, market_value in game["markets"].items():
                        if isinstance(market_value, (int, float)):
                            market_combs.append((market_name, float(market_value)))
            
            all_market_combinations.extend(market_combs)
            
            # Criar padrão sequencial
            pattern_markets = []
            market_counter = Counter(market_combs)
            for (market_name, odd), freq in market_counter.most_common(10):
                pattern_markets.append(MarketCombination(
                    market_name=market_name,
                    odd=odd,
                    frequency=freq,
                    percentage=(freq / len(games_before) * 100) if len(games_before) > 0 else 0
                ))
            
            sequential_patterns.append(SequentialPattern(
                pattern_description=f"Padrão antes do jogo às {target_game.get('hour', '?')}",
                games_before=[{
                    "hour": g.get("hour"),
                    "placarHT": g.get("placarHT"),
                    "placarFT": g.get("placarFT"),
                    "timeCasa": g.get("timeCasa"),
                    "timeFora": g.get("timeFora")
                } for g in games_before[-5:]],  # Últimos 5 jogos
                target_game={
                    "hour": target_game.get("hour"),
                    "placarHT": target_game.get("placarHT"),
                    "placarFT": target_game.get("placarFT"),
                    "timeCasa": target_game.get("timeCasa"),
                    "timeFora": target_game.get("timeFora")
                },
                score_sequence_ht=score_seq_ht[-5:],  # Últimos 5
                score_sequence_ft=score_seq_ft[-5:],  # Últimos 5
                market_combinations=pattern_markets[:5]  # Top 5
            ))
        
        # ==================== TOP SEQUÊNCIAS ====================
        
        # Top sequências de placares HT
        seq_ht_counter = Counter(all_score_sequences_ht)
        top_score_sequences_ht = [
            ScoreSequence(
                sequence=list(seq),
                frequency=count,
                percentage=(count / total_occurrences * 100) if total_occurrences > 0 else 0
            )
            for seq, count in seq_ht_counter.most_common(10)
        ]
        
        # Top sequências de placares FT
        seq_ft_counter = Counter(all_score_sequences_ft)
        top_score_sequences_ft = [
            ScoreSequence(
                sequence=list(seq),
                frequency=count,
                percentage=(count / total_occurrences * 100) if total_occurrences > 0 else 0
            )
            for seq, count in seq_ft_counter.most_common(10)
        ]
        
        # Top combinações de mercados
        market_comb_counter = Counter(all_market_combinations)
        top_market_combinations = [
            MarketCombination(
                market_name=market_name,
                odd=odd,
                frequency=count,
                percentage=(count / (total_occurrences * request.lookback_games) * 100) if (total_occurrences * request.lookback_games) > 0 else 0
            )
            for (market_name, odd), count in market_comb_counter.most_common(20)
        ]
        
        # ==================== DETECÇÃO DE CLUSTERS ====================
        
        # Detectar clusters apenas nos jogos onde o mercado-alvo ocorreu
        target_matches = [occ["match"] for occ in target_occurrences]
        temporal_clusters = detect_temporal_clusters(target_matches)
        
        # ==================== RECOMENDAÇÕES ====================
        
        recommendations = []
        
        # Recomendação 1: Horários mais frequentes
        if hourly_distribution:
            top_hours = sorted(hourly_distribution, key=lambda x: x.occurrences, reverse=True)[:3]
            hours_str = ", ".join([f"{h.hour}h ({h.occurrences}x)" for h in top_hours])
            recommendations.append(f"Horários mais frequentes: {hours_str}")
        
        # Recomendação 2: Sequências de placares
        if top_score_sequences_ht:
            top_seq = top_score_sequences_ht[0]
            if top_seq.percentage >= 20:
                recommendations.append(f"Sequência HT mais comum ({top_seq.percentage:.1f}%): {' → '.join(top_seq.sequence[-3:])}")
        
        # Recomendação 3: Mercados correlacionados
        if top_market_combinations:
            top_markets = [m for m in top_market_combinations if m.percentage >= 50][:3]
            if top_markets:
                markets_str = ", ".join([f"{m.market_name} (odd {m.odd})" for m in top_markets])
                recommendations.append(f"Mercados frequentes nos jogos anteriores: {markets_str}")
        
        # Recomendação 4: Clusters temporais
        if temporal_clusters:
            recommendations.append(f"{len(temporal_clusters)} cluster(s) temporal(is) detectado(s). Quando ocorrem 2+ jogos em sequência (até 2h), há maior probabilidade do mercado-alvo.")
        
        # Recomendação 5: Tamanho da amostra
        if total_occurrences < 5:
            recommendations.append("⚠️ Poucos dados (< 5 ocorrências). Considere analisar múltiplos dias para padrões mais confiáveis.")
        
        return AdvancedSequentialAnalysisResponse(
            date=request.reference_date,
            target_market=request.target_market,
            target_market_odd=target_market_odd,
            total_occurrences=total_occurrences,
            hourly_distribution=hourly_distribution,
            top_score_sequences_ht=top_score_sequences_ht,
            top_score_sequences_ft=top_score_sequences_ft,
            top_market_combinations=top_market_combinations,
            temporal_clusters=temporal_clusters,
            sequential_patterns=sequential_patterns,
            recommendations=recommendations
        )
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

