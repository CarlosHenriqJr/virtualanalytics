"""
pattern_discovery_ml.py - Sistema de Descoberta Automática de Padrões Sequenciais

Implementa um sistema de Machine Learning que:
1. Gera múltiplos padrões (gatilho + delay + entradas)
2. Avalia a assertividade de cada padrão
3. Identifica o melhor padrão de cada dia
4. Rastreia a persistência temporal dos padrões
"""

from fastapi import APIRouter, HTTPException
from typing import List, Optional, Dict, Any, Tuple
from datetime import datetime, timedelta
from pydantic import BaseModel
from database import get_database
from collections import defaultdict
import itertools

pattern_discovery_router = APIRouter(prefix="/pattern-discovery", tags=["pattern-discovery"])

# ==================== MODELOS ====================

class PatternDiscoveryRequest(BaseModel):
    target_market: str  # Mercado-alvo (ex: "TotalGols_MaisDe_35")
    start_date: str  # Data inicial (YYYY-MM-DD)
    end_date: str  # Data final (YYYY-MM-DD)
    min_delay: int = 5  # Mínimo de jogos de delay
    max_delay: int = 20  # Máximo de jogos de delay
    min_entries: int = 1  # Mínimo de entradas consecutivas
    max_entries: int = 5  # Máximo de entradas consecutivas

class TriggerDefinition(BaseModel):
    trigger_type: str  # "placar_ht", "placar_ft", "market", "odd_range"
    trigger_value: str  # Ex: "3-0", "TotalGols_MaisDe_25", "1.5-2.0"
    description: str

class PatternResult(BaseModel):
    trigger: TriggerDefinition
    delay_games: int
    consecutive_entries: int
    success_rate: float  # Taxa de sucesso (0-1)
    total_occurrences: int  # Quantas vezes o gatilho ocorreu
    successful_sequences: int  # Quantas sequências tiveram pelo menos 1 acerto
    failed_sequences: int  # Quantas sequências não tiveram nenhum acerto
    total_bets: int  # Total de apostas feitas
    winning_bets: int  # Total de apostas ganhas
    score: float  # Pontuação ponderada (para ranqueamento)

class DailyBestPattern(BaseModel):
    date: str
    target_market: str
    best_pattern: PatternResult
    runner_ups: List[PatternResult]  # Top 5 padrões alternativos

class PatternPersistence(BaseModel):
    pattern_signature: str  # Identificador único do padrão
    first_appearance: str  # Primeira vez que foi o melhor
    last_appearance: str  # Última vez que foi o melhor
    total_days_as_best: int  # Quantos dias foi o melhor
    consecutive_days: List[int]  # Sequências de dias consecutivos
    reappearance_intervals: List[int]  # Intervalos entre reaparecimentos (em dias)
    avg_reappearance_interval: float  # Média de dias até reaparecer
    persistence_score: float  # Pontuação de persistência (0-1)

class PatternDiscoveryResponse(BaseModel):
    target_market: str
    analysis_period: Dict[str, str]  # start_date, end_date
    total_days_analyzed: int
    daily_best_patterns: List[DailyBestPattern]
    pattern_persistence: List[PatternPersistence]
    recommendations: List[str]

# ==================== FUNÇÕES AUXILIARES ====================

def check_market_occurred(match: dict, market: str) -> bool:
    """Verifica se um mercado específico ocorreu (ganhou) no jogo."""
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
    
    return False

def generate_triggers() -> List[TriggerDefinition]:
    """Gera lista de gatilhos possíveis para testar."""
    triggers = []
    
    # 1. Placares extremos HT
    extreme_scores_ht = ["3-0", "0-3", "4-0", "0-4", "3-1", "1-3", "4-1", "1-4"]
    for score in extreme_scores_ht:
        triggers.append(TriggerDefinition(
            trigger_type="placar_ht",
            trigger_value=score,
            description=f"Placar HT: {score}"
        ))
    
    # 2. Placares extremos FT
    extreme_scores_ft = ["3-0", "0-3", "4-0", "0-4", "4-1", "1-4", "5-0", "0-5"]
    for score in extreme_scores_ft:
        triggers.append(TriggerDefinition(
            trigger_type="placar_ft",
            trigger_value=score,
            description=f"Placar FT: {score}"
        ))
    
    # 3. Total de gols HT
    for total in [0, 1, 2, 3, 4, 5]:
        triggers.append(TriggerDefinition(
            trigger_type="total_gols_ht",
            trigger_value=str(total),
            description=f"Total de gols HT: {total}"
        ))
    
    # 4. Mercados específicos
    key_markets = [
        "TotalGols_MaisDe_25",
        "TotalGols_MaisDe_35",
        "TotalGols_MaisDe_45",
        "ParaOTimeMarcarSimNao_AmbasMarcam"
    ]
    for market in key_markets:
        triggers.append(TriggerDefinition(
            trigger_type="market",
            trigger_value=market,
            description=f"Mercado: {market}"
        ))
    
    return triggers

def check_trigger(match: dict, trigger: TriggerDefinition) -> bool:
    """Verifica se um gatilho foi acionado em um jogo."""
    if trigger.trigger_type == "placar_ht":
        return match.get("placarHT", "") == trigger.trigger_value
    
    elif trigger.trigger_type == "placar_ft":
        return match.get("placarFT", "") == trigger.trigger_value
    
    elif trigger.trigger_type == "total_gols_ht":
        return match.get("totalGolsHT", -1) == int(trigger.trigger_value)
    
    elif trigger.trigger_type == "market":
        return check_market_occurred(match, trigger.trigger_value)
    
    return False

def evaluate_pattern(
    matches: List[dict],
    target_market: str,
    trigger: TriggerDefinition,
    delay_games: int,
    consecutive_entries: int
) -> PatternResult:
    """
    Avalia a assertividade de um padrão específico.
    
    Lógica:
    1. Encontra todos os jogos onde o gatilho foi acionado
    2. Para cada gatilho, espera N jogos (delay)
    3. Faz M apostas consecutivas no mercado-alvo
    4. Verifica se pelo menos 1 das M apostas ganhou
    """
    trigger_occurrences = []
    
    # Encontrar todas as ocorrências do gatilho
    for i, match in enumerate(matches):
        if check_trigger(match, trigger):
            trigger_occurrences.append(i)
    
    if len(trigger_occurrences) == 0:
        return PatternResult(
            trigger=trigger,
            delay_games=delay_games,
            consecutive_entries=consecutive_entries,
            success_rate=0.0,
            total_occurrences=0,
            successful_sequences=0,
            failed_sequences=0,
            total_bets=0,
            winning_bets=0,
            score=0.0
        )
    
    successful_sequences = 0
    failed_sequences = 0
    total_bets = 0
    winning_bets = 0
    
    for trigger_index in trigger_occurrences:
        # Índice onde começam as apostas (após o delay)
        start_bet_index = trigger_index + delay_games + 1
        
        # Verificar se há jogos suficientes para fazer as entradas
        if start_bet_index + consecutive_entries > len(matches):
            continue  # Não há jogos suficientes
        
        # Fazer as apostas consecutivas
        sequence_had_win = False
        for entry_offset in range(consecutive_entries):
            bet_index = start_bet_index + entry_offset
            total_bets += 1
            
            # Verificar se a aposta ganhou
            if check_market_occurred(matches[bet_index], target_market):
                winning_bets += 1
                sequence_had_win = True
        
        # Contar se a sequência foi bem-sucedida (pelo menos 1 acerto)
        if sequence_had_win:
            successful_sequences += 1
        else:
            failed_sequences += 1
    
    total_sequences = successful_sequences + failed_sequences
    success_rate = successful_sequences / total_sequences if total_sequences > 0 else 0.0
    
    # Calcular pontuação ponderada
    # Leva em conta: taxa de sucesso, frequência de ocorrências e número de apostas ganhas
    frequency_weight = min(total_sequences / 10, 1.0)  # Normalizar para 0-1
    score = (success_rate * 0.7) + (frequency_weight * 0.2) + ((winning_bets / max(total_bets, 1)) * 0.1)
    
    return PatternResult(
        trigger=trigger,
        delay_games=delay_games,
        consecutive_entries=consecutive_entries,
        success_rate=success_rate,
        total_occurrences=len(trigger_occurrences),
        successful_sequences=successful_sequences,
        failed_sequences=failed_sequences,
        total_bets=total_bets,
        winning_bets=winning_bets,
        score=score
    )

def calculate_pattern_signature(pattern: PatternResult) -> str:
    """Gera um identificador único para um padrão."""
    return f"{pattern.trigger.trigger_type}:{pattern.trigger.trigger_value}|delay:{pattern.delay_games}|entries:{pattern.consecutive_entries}"

def analyze_pattern_persistence(daily_patterns: List[DailyBestPattern]) -> List[PatternPersistence]:
    """Analisa a persistência temporal dos padrões."""
    pattern_history = defaultdict(list)  # signature -> [dates]
    
    # Agrupar por assinatura de padrão
    for daily in daily_patterns:
        signature = calculate_pattern_signature(daily.best_pattern)
        pattern_history[signature].append(daily.date)
    
    persistence_results = []
    
    for signature, dates in pattern_history.items():
        if len(dates) < 2:
            continue  # Ignorar padrões que apareceram apenas 1 vez
        
        # Ordenar datas
        sorted_dates = sorted(dates)
        
        # Calcular intervalos entre reaparecimentos
        intervals = []
        for i in range(1, len(sorted_dates)):
            date1 = datetime.strptime(sorted_dates[i-1], "%Y-%m-%d")
            date2 = datetime.strptime(sorted_dates[i], "%Y-%m-%d")
            interval_days = (date2 - date1).days
            intervals.append(interval_days)
        
        # Identificar sequências de dias consecutivos
        consecutive_sequences = []
        current_sequence = 1
        for interval in intervals:
            if interval == 1:
                current_sequence += 1
            else:
                if current_sequence > 1:
                    consecutive_sequences.append(current_sequence)
                current_sequence = 1
        if current_sequence > 1:
            consecutive_sequences.append(current_sequence)
        
        # Calcular média de reaparecimento
        avg_interval = sum(intervals) / len(intervals) if intervals else 0
        
        # Calcular pontuação de persistência
        # Quanto menor o intervalo médio e maior o número de dias, melhor
        persistence_score = len(dates) / (avg_interval + 1)  # +1 para evitar divisão por zero
        persistence_score = min(persistence_score, 1.0)  # Normalizar para 0-1
        
        persistence_results.append(PatternPersistence(
            pattern_signature=signature,
            first_appearance=sorted_dates[0],
            last_appearance=sorted_dates[-1],
            total_days_as_best=len(dates),
            consecutive_days=consecutive_sequences,
            reappearance_intervals=intervals,
            avg_reappearance_interval=avg_interval,
            persistence_score=persistence_score
        ))
    
    # Ordenar por pontuação de persistência (maior primeiro)
    persistence_results.sort(key=lambda x: x.persistence_score, reverse=True)
    
    return persistence_results

# ==================== ENDPOINT PRINCIPAL ====================

@pattern_discovery_router.post("/discover-patterns", response_model=PatternDiscoveryResponse)
async def discover_patterns(request: PatternDiscoveryRequest):
    """
    Descobre automaticamente os melhores padrões sequenciais para um mercado-alvo.
    
    Para cada dia no período:
    1. Gera múltiplos padrões (gatilho + delay + entradas)
    2. Avalia a assertividade de cada padrão
    3. Identifica o melhor padrão do dia
    4. Rastreia a persistência dos padrões ao longo do tempo
    """
    try:
        db = await get_database()
        
        # Converter datas
        start_date = datetime.strptime(request.start_date, "%Y-%m-%d")
        end_date = datetime.strptime(request.end_date, "%Y-%m-%d")
        
        # Gerar lista de datas
        date_range = []
        current_date = start_date
        while current_date <= end_date:
            date_range.append(current_date.strftime("%Y-%m-%d"))
            current_date += timedelta(days=1)
        
        # Gerar gatilhos
        triggers = generate_triggers()
        
        # Gerar combinações de delay e entradas
        delay_range = range(request.min_delay, request.max_delay + 1, 5)  # Incremento de 5
        entries_range = range(request.min_entries, request.max_entries + 1)
        
        daily_best_patterns = []
        
        # Analisar cada dia
        for date_str in date_range:
            # Buscar todos os jogos do dia
            query = {"date": date_str}
            cursor = db.partidas.find(query).sort("hour", 1)
            matches = await cursor.to_list(length=None)
            
            if len(matches) < 20:  # Mínimo de jogos para análise
                continue
            
            best_pattern = None
            best_score = 0.0
            all_patterns = []
            
            # Testar todas as combinações
            for trigger in triggers:
                for delay in delay_range:
                    for entries in entries_range:
                        pattern_result = evaluate_pattern(
                            matches,
                            request.target_market,
                            trigger,
                            delay,
                            entries
                        )
                        
                        all_patterns.append(pattern_result)
                        
                        if pattern_result.score > best_score:
                            best_score = pattern_result.score
                            best_pattern = pattern_result
            
            if best_pattern and best_pattern.total_occurrences > 0:
                # Ordenar todos os padrões por pontuação
                all_patterns.sort(key=lambda x: x.score, reverse=True)
                runner_ups = all_patterns[1:6]  # Top 5 alternativos
                
                daily_best_patterns.append(DailyBestPattern(
                    date=date_str,
                    target_market=request.target_market,
                    best_pattern=best_pattern,
                    runner_ups=runner_ups
                ))
        
        # Analisar persistência dos padrões
        pattern_persistence = analyze_pattern_persistence(daily_best_patterns)
        
        # Gerar recomendações
        recommendations = []
        
        if len(daily_best_patterns) > 0:
            avg_success_rate = sum(d.best_pattern.success_rate for d in daily_best_patterns) / len(daily_best_patterns)
            recommendations.append(f"Taxa de sucesso média dos melhores padrões: {avg_success_rate*100:.1f}%")
        
        if len(pattern_persistence) > 0:
            top_persistent = pattern_persistence[0]
            recommendations.append(f"Padrão mais persistente: {top_persistent.pattern_signature} (apareceu em {top_persistent.total_days_as_best} dias)")
            
            if top_persistent.avg_reappearance_interval < 3:
                recommendations.append(f"⚠️ Padrão de alta frequência detectado! Reaparece a cada {top_persistent.avg_reappearance_interval:.1f} dias em média")
        
        if len(daily_best_patterns) < len(date_range) * 0.5:
            recommendations.append("⚠️ Poucos dias com padrões válidos. Considere aumentar o período de análise ou ajustar os parâmetros.")
        
        return PatternDiscoveryResponse(
            target_market=request.target_market,
            analysis_period={
                "start_date": request.start_date,
                "end_date": request.end_date
            },
            total_days_analyzed=len(daily_best_patterns),
            daily_best_patterns=daily_best_patterns,
            pattern_persistence=pattern_persistence,
            recommendations=recommendations
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))




# ==================== ENDPOINT DE ESTUDO DIÁRIO ====================

class DailyStudyRequest(BaseModel):
    target_market: str
    date: str  # YYYY-MM-DD
    min_delay: int = 5
    max_delay: int = 20
    min_entries: int = 1
    max_entries: int = 5
    top_n: int = 10  # Quantos padrões retornar

class DailyStudyResponse(BaseModel):
    date: str
    target_market: str
    total_matches: int
    total_patterns_tested: int
    top_patterns: List[PatternResult]
    best_pattern_summary: str

@pattern_discovery_router.post("/daily-study", response_model=DailyStudyResponse)
async def daily_study(request: DailyStudyRequest):
    """
    Estudo diário: descobre os melhores padrões para um dia específico.
    
    Útil para análise rápida de um único dia.
    """
    try:
        db = await get_database()
        
        # Buscar todos os jogos do dia
        query = {"date": request.date}
        cursor = db.partidas.find(query).sort("hour", 1)
        matches = await cursor.to_list(length=None)
        
        if len(matches) == 0:
            raise HTTPException(status_code=404, detail=f"Nenhum jogo encontrado na data {request.date}")
        
        # Gerar gatilhos
        triggers = generate_triggers()
        
        # Gerar combinações de delay e entradas
        delay_range = range(request.min_delay, request.max_delay + 1, 5)
        entries_range = range(request.min_entries, request.max_entries + 1)
        
        all_patterns = []
        
        # Testar todas as combinações
        for trigger in triggers:
            for delay in delay_range:
                for entries in entries_range:
                    pattern_result = evaluate_pattern(
                        matches,
                        request.target_market,
                        trigger,
                        delay,
                        entries
                    )
                    
                    if pattern_result.total_occurrences > 0:
                        all_patterns.append(pattern_result)
        
        # Ordenar por pontuação
        all_patterns.sort(key=lambda x: x.score, reverse=True)
        
        # Pegar top N
        top_patterns = all_patterns[:request.top_n]
        
        # Gerar resumo do melhor padrão
        best_summary = "Nenhum padrão encontrado"
        if len(top_patterns) > 0:
            best = top_patterns[0]
            best_summary = (
                f"Gatilho: {best.trigger.description} | "
                f"Delay: {best.delay_games} jogos | "
                f"Entradas: {best.consecutive_entries} apostas | "
                f"Taxa de sucesso: {best.success_rate*100:.1f}% | "
                f"Ocorrências: {best.total_occurrences}x | "
                f"Sequências bem-sucedidas: {best.successful_sequences}/{best.successful_sequences + best.failed_sequences}"
            )
        
        return DailyStudyResponse(
            date=request.date,
            target_market=request.target_market,
            total_matches=len(matches),
            total_patterns_tested=len(all_patterns),
            top_patterns=top_patterns,
            best_pattern_summary=best_summary
        )
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

