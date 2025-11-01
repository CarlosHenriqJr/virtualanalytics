"""
analysis_routes.py - Versão Atualizada para Coleção "partidas"

Versão adaptada para trabalhar com a estrutura real dos dados:
- Coleção: "partidas" (não "matches")
- Markets: valores numéricos (odds) em vez de "green"/"red"
- Análise baseada em resultados reais das partidas
"""

from fastapi import APIRouter, HTTPException, Query, Depends
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from pydantic import BaseModel
from database import get_database, get_db
from motor.motor_asyncio import AsyncIOMotorDatabase
import logging

# Configura um logger para este módulo
logger = logging.getLogger(__name__)

analysis_router = APIRouter(prefix="/analysis", tags=["analysis"])

# ==================== MODELOS ====================

class TriggerAnalysisRequest(BaseModel):
    market: str
    reference_date: str
    lookback_days: int = 30

class HistoricalTriggerAnalysisRequest(BaseModel):
    market: str
    start_date: str
    end_date: str
    aggregation: str = "daily"  # daily, weekly, monthly

class TriggerResult(BaseModel):
    trigger_name: str
    success_rate: float
    total_occurrences: int
    successful_occurrences: int

class HistoricalResult(BaseModel):
    period: str
    total_matches: int
    successful_matches: int
    success_rate: float

# ==================== HEALTH CHECK ====================

@analysis_router.get("/health")
async def health_check():
    """
    Endpoint de health check para verificar a conexão com o MongoDB
    e retornar estatísticas básicas dos dados disponíveis.
    """
    try:
        db = await get_database()
        
        # Verificar se consegue acessar o banco
        # Contar documentos na coleção "partidas"
        total_matches = await db.partidas.count_documents({})
        
        # Buscar data mais antiga e mais recente
        oldest_match = await db.partidas.find_one({}, sort=[("date", 1)])
        newest_match = await db.partidas.find_one({}, sort=[("date", -1)])
        
        return {
            "status": "connected",
            "database": "MongoDB",
            "collection": "partidas",
            "total_matches": total_matches,
            "oldest_date": oldest_match.get("date") if oldest_match else None,
            "newest_date": newest_match.get("date") if newest_match else None,
            "message": f"Banco de dados conectado com sucesso. {total_matches} jogos disponíveis."
        }
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail=f"Erro ao conectar ao banco de dados: {str(e)}"
        )

# ==================== MERCADOS ====================

@analysis_router.get("/markets")
async def get_available_markets():
    """
    Retorna todos os mercados disponíveis nos dados históricos.
    (Nome mantido como /markets, frontend será ajustado)
    """
    try:
        db = await get_database()
        
        # Buscar um jogo de exemplo para extrair os mercados
        sample_match = await db.partidas.find_one(
            {"markets": {"$exists": True, "$ne": None, "$ne": {}}},
            {"markets": 1}
        )
        
        if not sample_match or "markets" not in sample_match:
            logger.warning("Nenhum 'markets' encontrado para listar mercados.")
            return {"markets": []}
        
        # Extrair nomes dos mercados
        markets = list(sample_match["markets"].keys())
        
        # Filtrar apenas mercados numéricos (odds), excluir campos de resultado
        numeric_markets = []
        for market in markets:
            value = sample_match["markets"][market]
            if isinstance(value, (int, float)):
                numeric_markets.append(market)
        
        numeric_markets.sort()
        
        return {"markets": numeric_markets}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@analysis_router.get("/dates")
async def get_available_dates():
    """
    Retorna UMA LISTA de datas (YYYY-MM-DD) únicas disponíveis no banco,
    conforme esperado pelo frontend.
    """
    try:
        db = await get_database()
        
        # Usa distinct para pegar valores únicos do campo 'date'
        dates = await db.partidas.distinct("date")
        
        if not dates:
            return {"dates": []}
            
        # Ordena as datas (assumindo formato YYYY-MM-DD)
        dates.sort(reverse=True)
        return {"dates": dates}
        
    except Exception as e:
        logger.error(f"Erro ao buscar datas disponíveis: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erro ao buscar datas: {str(e)}")

# ==================== JOGOS ====================

@analysis_router.get("/matches")
async def get_matches(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=1000)
):
    """
    Retorna jogos dentro de um intervalo de datas.
    """
    try:
        db = await get_database()
        
        # Construir filtro de data
        date_filter = {}
        if start_date:
            date_filter["$gte"] = start_date
        if end_date:
            date_filter["$lte"] = end_date
        
        query = {}
        if date_filter:
            query["date"] = date_filter
        
        # Buscar jogos na coleção "partidas"
        cursor = db.partidas.find(query).sort("date", -1).limit(limit)
        matches = await cursor.to_list(length=limit)
        
        # Converter ObjectId para string
        for match in matches:
            if "_id" in match:
                match["_id"] = str(match["_id"])
        
        return matches
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==================== FUNÇÕES DE ANÁLISE ====================

def check_market_result(match: dict, market: str) -> bool:
    """
    Verifica se um mercado específico foi "green" (ganhou) com base no resultado da partida.
    
    Exemplos:
    - "TotalGols_MaisDe_25": Verifica se totalGolsFT > 2.5
    - "TotalGols_MenosDe_15": Verifica se totalGolsFT < 1.5
    - "VencedorFT_Casa": Verifica se placarCasaFT > placarForaFT
    """
    
    if "markets" not in match or market not in match["markets"]:
        return False
    
    total_gols = match.get("totalGolsFT", 0)
    placar_casa = match.get("placarCasaFT", 0)
    placar_fora = match.get("placarForaFT", 0)
    
    # Análise de Total de Gols
    if "TotalGols_MaisDe_" in market:
        try:
            threshold_str = market.split("_")[-1].replace("05", "0.5").replace("15", "1.5").replace("25", "2.5").replace("35", "3.5").replace("45", "4.5")
            threshold = float(threshold_str)
            return total_gols > threshold
        except (ValueError, IndexError):
            return False
    
    elif "TotalGols_MenosDe_" in market:
        try:
            threshold_str = market.split("_")[-1].replace("05", "0.5").replace("15", "1.5").replace("25", "2.5").replace("35", "3.5").replace("45", "4.5")
            threshold = float(threshold_str)
            return total_gols < threshold
        except (ValueError, IndexError):
            return False
    
    # Análise de Vencedor
    elif market == "VencedorFT_Casa":
        return placar_casa > placar_fora
    
    elif market == "VencedorFT_Visitante":
        return placar_fora > placar_casa
    
    elif market == "VencedorFT_Empate":
        return placar_casa == placar_fora
    
    # Análise de Gols Exatos
    elif "GolsExatos_" in market:
        try:
            if market == "GolsExatos_5_Mais":
                return total_gols >= 5
            else:
                gols_exatos = int(market.split("_")[-1])
                return total_gols == gols_exatos
        except (ValueError, IndexError):
            return False
            
    # Análise de Ambas Marcam
    elif market == "ParaOTimeMarcarSimNao_AmbasMarcam":
        return placar_casa > 0 and placar_fora > 0
    
    elif market == "ParaOTimeMarcarSimNao_AmbasNaoMarcam":
        return placar_casa == 0 or placar_fora == 0
    
    # Análise de Time Marcar
    elif market == "ParaOTimeMarcarSimNao_CasaSim":
        return placar_casa > 0
    
    elif market == "ParaOTimeMarcarSimNao_CasaNao":
        return placar_casa == 0
    
    elif market == "ParaOTimeMarcarSimNao_VisitanteSim":
        return placar_fora > 0
    
    elif market == "ParaOTimeMarcarSimNao_VisitanteNao":
        return placar_fora == 0
    
    # Análise de Dupla Hipótese
    elif market == "DuplaHipotese_CasaOuEmpate":
        return placar_casa >= placar_fora
    
    elif market == "DuplaHipotese_CasaOuVisitante":
        return placar_casa != placar_fora
    
    elif market == "DuplaHipotese_EmpateOuVisitante":
        return placar_casa <= placar_fora
    
    # Análise de Margem de Vitória
    elif "MargemVitoriaGols_Casa" in market:
        try:
            diff = placar_casa - placar_fora
            if market == "MargemVitoriaGols_Casa1":
                return diff == 1
            elif market == "MargemVitoriaGols_Casa2":
                return diff == 2
            elif market == "MargemVitoriaGols_Casa3Mais":
                return diff >= 3
        except (TypeError):
            return False
    
    elif "MargemVitoriaGols_Visitante" in market:
        try:
            diff = placar_fora - placar_casa
            if market == "MargemVitoriaGols_Visitante1":
                return diff == 1
            elif market == "MargemVitoriaGols_Visitante2":
                return diff == 2
            elif market == "MargemVitoriaGols_Visitante3Mais":
                return diff >= 3
        except (TypeError):
            return False
            
    elif market == "MargemVitoriaGols_SemGols":
        return total_gols == 0
    
    elif market == "MargemVitoriaGols_EmpateComGols":
        return placar_casa == placar_fora and total_gols > 0
    
    # Se não conseguir determinar, retorna False
    return False

def extract_triggers_from_match(match: dict, market: str) -> List[dict]:
    """
    Extrai gatilhos de um jogo específico para um mercado.
    
    Gatilhos são padrões observáveis antes do resultado final, como:
    - Placar no HT (Half Time)
    - Total de gols no HT
    - Resultado no HT (casa/empate/fora)
    """
    triggers = []
    
    if "markets" not in match or market not in match["markets"]:
        return triggers
    
    # Verificar se o mercado foi "green"
    market_success = check_market_result(match, market)
    
    placar_ht = match.get("placarHT", "")
    
    if not placar_ht:
        return triggers
    
    try:
        gols_casa_ht = match.get("placarCasaHT", 0)
        gols_fora_ht = match.get("placarForaHT", 0)
        total_gols_ht = gols_casa_ht + gols_fora_ht
        
        # Gatilho 1: Placar exato no HT
        triggers.append({
            "name": f"Placar HT: {placar_ht}",
            "type": "exact_score_ht",
            "value": placar_ht,
            "success": market_success
        })
        
        # Gatilho 2: Total de gols no HT
        triggers.append({
            "name": f"Total de gols HT: {total_gols_ht}",
            "type": "total_goals_ht",
            "value": total_gols_ht,
            "success": market_success
        })
        
        # Gatilho 3: Resultado no HT
        if gols_casa_ht > gols_fora_ht:
            resultado_ht = "Casa vencendo"
        elif gols_casa_ht < gols_fora_ht:
            resultado_ht = "Fora vencendo"
        else:
            resultado_ht = "Empate"
        
        triggers.append({
            "name": f"Resultado HT: {resultado_ht}",
            "type": "result_ht",
            "value": resultado_ht,
            "success": market_success
        })
        
        # Gatilho 4: Faixas de gols no HT
        if total_gols_ht == 0:
            faixa = "0 gols"
        elif total_gols_ht <= 2:
            faixa = "1-2 gols"
        elif total_gols_ht <= 4:
            faixa = "3-4 gols"
        else:
            faixa = "5+ gols"
        
        triggers.append({
            "name": f"Faixa de gols HT: {faixa}",
            "type": "goal_range_ht",
            "value": faixa,
            "success": market_success
        })
        
    except (ValueError, AttributeError, TypeError):
        pass
    
    return triggers

def calculate_trigger_effectiveness(triggers_data: List[dict]) -> List[TriggerResult]:
    """
    Calcula a efetividade de cada gatilho com base nos dados históricos.
    """
    trigger_stats = {}
    
    for trigger in triggers_data:
        name = trigger["name"]
        success = trigger["success"]
        
        if name not in trigger_stats:
            trigger_stats[name] = {"total": 0, "successful": 0}
        
        trigger_stats[name]["total"] += 1
        if success:
            trigger_stats[name]["successful"] += 1
    
    # Converter para lista de resultados
    results = []
    for name, stats in trigger_stats.items():
        success_rate = stats["successful"] / stats["total"] if stats["total"] > 0 else 0
        results.append(TriggerResult(
            trigger_name=name,
            success_rate=success_rate,
            total_occurrences=stats["total"],
            successful_occurrences=stats["successful"]
        ))
    
    # Ordenar por taxa de sucesso (decrescente) e depois por total de ocorrências
    results.sort(key=lambda x: (x.success_rate, x.total_occurrences), reverse=True)
    
    return results


# ==================== ANÁLISE DE PERFORMANCE DE TRIGGERS ====================

class TriggerPerformanceRequest(BaseModel):
    trigger_condition: Dict[str, Any]  # Ex: {"IntervaloVencedor": "Visitante"}
    target_market: str                 # Ex: "Over_3_5"
    skip_games: int = 60              # Pulos
    max_attempts: int = 4             # Tiros (Gales)
    start_date: str
    end_date: str

class DailyPerformance(BaseModel):
    date: str
    total_matches: int
    green_count: int
    red_count: int
    success_rate: float
    gale_breakdown: Dict[str, int]  # {"SG": 5, "G1": 5, "G2": 5, "G3": 3}
    leagues: List[str]

class TriggerAnalysisResponse(BaseModel):
    trigger_name: str
    overall_performance: Dict[str, Any]
    daily_performance: List[DailyPerformance]
    volatility_analysis: Dict[str, Any]
    correlation_insights: List[str]
    recommendations: List[str]

def check_trigger_condition(match: dict, trigger_condition: Dict[str, Any]) -> bool:
    """
    Verifica se um jogo atende às condições do trigger.
    
    Exemplos de trigger_condition:
    - {"IntervaloVencedor": "Visitante"}
    - {"TotalGolsHT": "MaisDe_1_5"}
    - {"ResultadoHT": "Empate"}
    - {"AmbasMarcamHT": "Sim"}
    """
    try:
        for condition_key, condition_value in trigger_condition.items():
            
            # Intervalo Vencedor
            if condition_key == "IntervaloVencedor":
                placar_casa_ht = match.get("placarCasaHT", 0)
                placar_fora_ht = match.get("placarForaHT", 0)
                
                if condition_value == "Casa":
                    return placar_casa_ht > placar_fora_ht
                elif condition_value == "Visitante":
                    return placar_fora_ht > placar_casa_ht
                elif condition_value == "Empate":
                    return placar_casa_ht == placar_fora_ht
            
            # Total de Gols HT
            elif condition_key == "TotalGolsHT":
                total_gols_ht = match.get("placarCasaHT", 0) + match.get("placarForaHT", 0)
                
                if "MaisDe_" in condition_value:
                    try:
                        threshold = float(condition_value.replace("MaisDe_", "").replace("_", "."))
                        return total_gols_ht > threshold
                    except ValueError:
                        return False
                elif "MenosDe_" in condition_value:
                    try:
                        threshold = float(condition_value.replace("MenosDe_", "").replace("_", "."))
                        return total_gols_ht < threshold
                    except ValueError:
                        return False
            
            # Resultado HT
            elif condition_key == "ResultadoHT":
                placar_casa_ht = match.get("placarCasaHT", 0)
                placar_fora_ht = match.get("placarForaHT", 0)
                
                if condition_value == "Casa":
                    return placar_casa_ht > placar_fora_ht
                elif condition_value == "Visitante":
                    return placar_fora_ht > placar_casa_ht
                elif condition_value == "Empate":
                    return placar_casa_ht == placar_fora_ht
            
            # Ambas Marcam HT
            elif condition_key == "AmbasMarcamHT":
                placar_casa_ht = match.get("placarCasaHT", 0)
                placar_fora_ht = match.get("placarForaHT", 0)
                
                if condition_value == "Sim":
                    return placar_casa_ht > 0 and placar_fora_ht > 0
                elif condition_value == "Nao":
                    return placar_casa_ht == 0 or placar_fora_ht == 0
            
            # Time Marcando HT
            elif condition_key == "TimeMarcandoHT":
                if condition_value == "Casa":
                    return match.get("placarCasaHT", 0) > 0
                elif condition_value == "Visitante":
                    return match.get("placarForaHT", 0) > 0
                elif condition_value == "Nenhum":
                    return match.get("placarCasaHT", 0) == 0 and match.get("placarForaHT", 0) == 0
            
            # Placar Exato HT
            elif condition_key == "PlacarExatoHT":
                placar_ht = match.get("placarHT", "")
                return placar_ht == condition_value
            
            # Condição customizada para odds
            elif condition_key == "OddCondition":
                market_name = condition_value.get("market")
                operator = condition_value.get("operator")
                value = condition_value.get("value")
                
                if market_name in match.get("markets", {}):
                    market_odd = match["markets"][market_name]
                    
                    if operator == "greater":
                        return market_odd > value
                    elif operator == "less":
                        return market_odd < value
                    elif operator == "equal":
                        return market_odd == value
        
        return False
        
    except Exception as e:
        logger.error(f"Erro ao verificar condição do trigger: {e}")
        return False

def simulate_gale_strategy(matches: List[dict], target_market: str, skip_games: int, max_attempts: int) -> Dict[str, Any]:
    """
    Simula a estratégia de Gale com LOGS DETALHADOS para debug.
    """
    logger.info(f"=== INICIANDO SIMULAÇÃO DE GALE ===")
    logger.info(f"Total de jogos recebidos: {len(matches)}")
    logger.info(f"Target market: {target_market}")
    logger.info(f"Skip games: {skip_games}")
    logger.info(f"Max attempts (gales): {max_attempts}")
    
    gale_breakdown = {f"G{i}": 0 for i in range(max_attempts)}
    gale_breakdown["SG"] = 0
    
    total_green = 0
    total_red = 0
    total_entries = 0  # ← CONTADOR DE ENTRADAS
    
    i = 0
    operation_count = 0
    
    while i < len(matches):
        # Verificar disponibilidade do mercado
        match = matches[i]
        
        if "markets" not in match or target_market not in match["markets"]:
            i += 1
            continue
        
        # ========================================
        # OPERAÇÃO INICIADA
        # ========================================
        operation_count += 1
        logger.info(f"\n--- OPERAÇÃO #{operation_count} (índice {i}) ---")
        logger.info(f"Data: {match.get('date', 'N/A')}, Hora: {match.get('hour', 'N/A')}")
        
        gale_won = False
        win_at_attempt = -1
        
        # Tentar até max_attempts
        for attempt in range(max_attempts):
            entry_index = i + attempt
            
            if entry_index >= len(matches):
                logger.warning(f"Tentativa {attempt}: Sem mais jogos disponíveis")
                break
            
            entry_match = matches[entry_index]
            
            # Verificar mercado
            if "markets" not in entry_match or target_market not in entry_match["markets"]:
                logger.warning(f"Tentativa {attempt}: Mercado não disponível no jogo {entry_index}")
                continue
            
            # CONTABILIZAR ENTRADA
            total_entries += 1
            
            # Verificar resultado
            market_won = check_market_result(entry_match, target_market)
            
            logger.info(f"  Tentativa {attempt} (jogo {entry_index}): {'GREEN ✅' if market_won else 'RED ❌'}")
            logger.info(f"    Placar: {entry_match.get('placarFT', 'N/A')}, Total Gols: {entry_match.get('totalGolsFT', 'N/A')}")
            
            if market_won:
                # ACERTOU
                gale_won = True
                win_at_attempt = attempt
                
                if attempt == 0:
                    gale_breakdown["SG"] += 1
                    logger.info(f"  → Resultado: GREEN SEM GALE")
                else:
                    gale_key = f"G{attempt - 1}"
                    gale_breakdown[gale_key] += 1
                    logger.info(f"  → Resultado: GREEN NO {gale_key}")
                
                total_green += 1
                break
        
        if not gale_won:
            # PERDEU TODOS OS GALES
            total_red += 1
            logger.info(f"  → Resultado: RED (perdeu todos os {max_attempts} gales)")
        
        # Avançar índice
        if gale_won:
            next_i = i + win_at_attempt + 1 + skip_games
            logger.info(f"  Avançando para índice {next_i} (atual {i} + tentativas {win_at_attempt + 1} + pulos {skip_games})")
        else:
            next_i = i + max_attempts
            logger.info(f"  Avançando para índice {next_i} (atual {i} + max_attempts {max_attempts})")
        
        i = next_i
    
    # ========================================
    # RESULTADO FINAL
    # ========================================
    success_rate = total_green / (total_green + total_red) if (total_green + total_red) > 0 else 0
    
    logger.info(f"\n=== RESULTADO FINAL ===")
    logger.info(f"Total de ENTRADAS: {total_entries}")
    logger.info(f"Total de OPERAÇÕES: {operation_count}")
    logger.info(f"Total Greens: {total_green}")
    logger.info(f"Total Reds: {total_red}")
    logger.info(f"Soma (Greens + Reds): {total_green + total_red}")
    logger.info(f"Success Rate: {success_rate:.2%}")
    logger.info(f"Gale Breakdown: {gale_breakdown}")
    logger.info(f"Soma Gales: {sum(gale_breakdown.values())}")
    
    # VALIDAÇÃO
    if (total_green + total_red) != operation_count:
        logger.error(f"❌ ERRO: Greens ({total_green}) + Reds ({total_red}) ≠ Operações ({operation_count})")
    
    if sum(gale_breakdown.values()) != total_green:
        logger.error(f"❌ ERRO: Soma dos gales ({sum(gale_breakdown.values())}) ≠ Total Greens ({total_green})")
    
    return {
        "total_green": total_green,
        "total_red": total_red,
        "success_rate": success_rate,
        "gale_breakdown": gale_breakdown,
        "total_operations": total_green + total_red,  # ← Deve ser igual a operation_count
        "total_entries": total_entries  # ← NOVO: total de apostas feitas
    }

@analysis_router.post("/trigger-performance", response_model=TriggerAnalysisResponse)
async def analyze_trigger_performance(request: TriggerPerformanceRequest):
    """
    Analisa a performance de um trigger específico com estratégia de Gale.
    """
    try:
        db = await get_database()
        
        # Buscar jogos no período
        query = {
            "date": {
                "$gte": request.start_date,
                "$lte": request.end_date
            }
        }
        
        cursor = db.partidas.find(query).sort("date", 1)
        matches = await cursor.to_list(length=None)
        
        if not matches:
            raise HTTPException(status_code=404, detail="Nenhum jogo encontrado no período especificado")
        
        # Filtrar jogos que atendem ao trigger
        triggered_matches = []
        for match in matches:
            if check_trigger_condition(match, request.trigger_condition):
                triggered_matches.append(match)
        
        if not triggered_matches:
            raise HTTPException(status_code=404, detail="Nenhum jogo atendeu às condições do trigger")
        
        # ========================================
        # CORREÇÃO: Agrupar por data DEPOIS de simular o gale
        # ========================================
        
        # 1. SIMULAR GALE NO DATASET COMPLETO PRIMEIRO
        overall_stats = simulate_gale_strategy(
            triggered_matches, 
            request.target_market, 
            request.skip_games, 
            request.max_attempts
        )
        
        # 2. AGORA SIMULAR DIA A DIA PARA ANÁLISE DIÁRIA
        daily_data = {}
        for match in triggered_matches:
            date_str = match.get("date", "")
            if date_str not in daily_data:
                daily_data[date_str] = []
            daily_data[date_str].append(match)
        
        # 3. SIMULAR GALE PARA CADA DIA SEPARADAMENTE
        daily_performance = []
        for date_str, day_matches in sorted(daily_data.items()):
            # Simular estratégia de Gale APENAS para este dia
            day_stats = simulate_gale_strategy(
                day_matches, 
                request.target_market, 
                request.skip_games, 
                request.max_attempts
            )
            
            # Extrair ligas únicas do dia
            day_leagues = list(set([m.get("league", "Desconhecida") for m in day_matches]))
            
            daily_performance.append(DailyPerformance(
                date=date_str,
                total_matches=day_stats["total_operations"],  # ← CORREÇÃO AQUI
                green_count=day_stats["total_green"],
                red_count=day_stats["total_red"],
                success_rate=day_stats["success_rate"],
                gale_breakdown=day_stats["gale_breakdown"],
                leagues=day_leagues
            ))
        
        # Análise de volatilidade
        success_rates = [day.success_rate for day in daily_performance if day.total_matches > 0]
        volatility_analysis = {
            "avg_success_rate": sum(success_rates) / len(success_rates) if success_rates else 0,
            "max_success_rate": max(success_rates) if success_rates else 0,
            "min_success_rate": min(success_rates) if success_rates else 0,
            "std_deviation": (sum((x - (sum(success_rates) / len(success_rates))) ** 2 for x in success_rates) / len(success_rates)) ** 0.5 if success_rates else 0,
            "consistency_score": len([x for x in success_rates if x >= 0.5]) / len(success_rates) if success_rates else 0
        }
        
        # Insights de correlação
        correlation_insights = generate_correlation_insights(triggered_matches, request.target_market, daily_performance)
        
        # Recomendações
        recommendations = generate_recommendations(overall_stats, volatility_analysis, request)
        
        # Nome do trigger
        trigger_name = generate_trigger_name(request.trigger_condition)
        
        return TriggerAnalysisResponse(
            trigger_name=trigger_name,
            overall_performance={
                "total_matches_analyzed": len(triggered_matches),
                "total_operations": overall_stats["total_operations"],
                "total_green": overall_stats["total_green"],
                "total_red": overall_stats["total_red"],
                "overall_success_rate": overall_stats["success_rate"],
                "gale_breakdown": overall_stats["gale_breakdown"],
                "expected_value": calculate_expected_value(overall_stats, request),
                "total_entries": overall_stats.get("total_entries", 0)  # ← Adicionar aqui
            },
            daily_performance=daily_performance,
            volatility_analysis=volatility_analysis,
            correlation_insights=correlation_insights,
            recommendations=recommendations
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro na análise de performance do trigger: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erro na análise: {str(e)}")
    

def generate_trigger_name(trigger_condition: Dict[str, Any]) -> str:
    """Gera um nome descritivo para o trigger"""
    parts = []
    for key, value in trigger_condition.items():
        parts.append(f"{key}:{value}")
    return " | ".join(parts)

def generate_correlation_insights(matches: List[dict], target_market: str, daily_performance: List[DailyPerformance]) -> List[str]:
    """Gera insights de correlação baseados nos dados diários"""
    insights = []
    
    if not daily_performance:
        return ["Dados insuficientes para análise de correlação"]
    
    # 1. Análise por dia da semana
    from datetime import datetime
    weekday_stats = {}
    
    for day_perf in daily_performance:
        try:
            date_obj = datetime.strptime(day_perf.date, "%Y-%m-%d")
            weekday = date_obj.strftime("%A")  # Segunda, Terça, etc
            
            if weekday not in weekday_stats:
                weekday_stats[weekday] = {"rates": [], "operations": 0}
            
            weekday_stats[weekday]["rates"].append(day_perf.success_rate)
            weekday_stats[weekday]["operations"] += day_perf.total_matches
        except:
            pass
    
    # Encontrar melhor e pior dia da semana
    if weekday_stats:
        weekday_avgs = {day: sum(stats["rates"])/len(stats["rates"]) for day, stats in weekday_stats.items() if stats["rates"]}
        
        if weekday_avgs:
            best_day = max(weekday_avgs.items(), key=lambda x: x[1])
            worst_day = min(weekday_avgs.items(), key=lambda x: x[1])
            
            insights.append(f"📅 Melhor dia: {best_day[0]} ({best_day[1]:.1%} de acerto)")
            insights.append(f"📅 Pior dia: {worst_day[0]} ({worst_day[1]:.1%} de acerto)")
    
    # 2. Análise de volume
    high_volume_days = [d for d in daily_performance if d.total_matches >= 5]
    low_volume_days = [d for d in daily_performance if d.total_matches < 5]
    
    if high_volume_days and low_volume_days:
        high_vol_avg = sum(d.success_rate for d in high_volume_days) / len(high_volume_days)
        low_vol_avg = sum(d.success_rate for d in low_volume_days) / len(low_volume_days)
        
        if high_vol_avg > low_vol_avg + 0.1:
            insights.append(f"📊 Dias com mais operações (≥5) têm {(high_vol_avg - low_vol_avg):.1%} mais assertividade")
        elif low_vol_avg > high_vol_avg + 0.1:
            insights.append(f"⚠️ Dias com menos operações (<5) têm {(low_vol_avg - high_vol_avg):.1%} mais assertividade")
    
    # 3. Análise de sequências
    consecutive_good = 0
    max_consecutive_good = 0
    consecutive_bad = 0
    max_consecutive_bad = 0
    
    for day_perf in sorted(daily_performance, key=lambda x: x.date):
        if day_perf.success_rate >= 0.7:
            consecutive_good += 1
            consecutive_bad = 0
            max_consecutive_good = max(max_consecutive_good, consecutive_good)
        elif day_perf.success_rate < 0.5:
            consecutive_bad += 1
            consecutive_good = 0
            max_consecutive_bad = max(max_consecutive_bad, consecutive_bad)
        else:
            consecutive_good = 0
            consecutive_bad = 0
    
    if max_consecutive_good >= 3:
        insights.append(f"✅ Teve sequência de {max_consecutive_good} dias bons consecutivos")
    
    if max_consecutive_bad >= 3:
        insights.append(f"⚠️ Teve sequência de {max_consecutive_bad} dias ruins consecutivos")
    
    # 4. Análise de gales
    total_sg = sum(d.gale_breakdown.get("SG", 0) for d in daily_performance)
    total_greens = sum(d.green_count for d in daily_performance)
    
    if total_greens > 0:
        sg_rate = total_sg / total_greens
        
        if sg_rate >= 0.5:
            insights.append(f"🎯 {sg_rate:.1%} dos acertos são sem gale (SG) - Excelente!")
        elif sg_rate < 0.3:
            insights.append(f"⚠️ Apenas {sg_rate:.1%} dos acertos são sem gale - Depende muito de recuperação")
    
    return insights if insights else ["Performance estável sem padrões claros detectados"]

def generate_recommendations(overall_stats: Dict, volatility_analysis: Dict, request: TriggerPerformanceRequest) -> List[str]:
    """Gera recomendações baseadas na análise"""
    recommendations = []
    
    success_rate = overall_stats["success_rate"]
    total_ops = overall_stats["total_operations"]
    
    if total_ops < 10:
        recommendations.append("⚠️ Amostra muito pequena para conclusões definitivas")
    
    if success_rate >= 0.7:
        recommendations.append("✅ Trigger altamente eficiente - considere aumentar exposição")
    elif success_rate >= 0.6:
        recommendations.append("✅ Bom desempenho - estratégia viável")
    elif success_rate >= 0.5:
        recommendations.append("⚡ Performance moderada - monitorar continuamente")
    else:
        recommendations.append("❌ Performance abaixo do esperado - revisar critérios")
    
    if volatility_analysis["std_deviation"] > 0.2:
        recommendations.append("📊 Alta volatilidade - considerar redução de stake")
    
    if overall_stats["gale_breakdown"]["G3"] > overall_stats["gale_breakdown"]["SG"]:
        recommendations.append("🎯 Muitos acertos em Gales altos - ajustar critérios de entrada")
    
    # Recomendação de bankroll baseada no risco
    risk_level = "ALTO" if success_rate < 0.55 else "MODERADO" if success_rate < 0.65 else "BAIXO"
    recommendations.append(f"💰 Bankroll recomendado: 1-2% por operação (Risco {risk_level})")
    
    return recommendations

def calculate_expected_value(overall_stats: Dict, request: TriggerPerformanceRequest) -> float:
    """Calcula o valor esperado da estratégia"""
    # Simplificado - assumindo odds fixas para exemplo
    # Na prática, usar as odds reais dos mercados
    base_odd = 2.0  # Odd assumida de 2.0
    
    success_rate = overall_stats["success_rate"]
    failure_rate = 1 - success_rate
    
    # Cálculo simplificado do EV
    ev = (success_rate * (base_odd - 1)) - (failure_rate * 1)
    return ev

# ==================== ANÁLISE DE GATILHOS ====================

@analysis_router.post("/trigger-analysis")
async def analyze_triggers(request: TriggerAnalysisRequest):
    """
    Analisa gatilhos para um mercado específico em um período de tempo.
    """
    try:
        db = await get_database()
        
        # Calcular data de início
        reference_date = datetime.strptime(request.reference_date, "%Y-%m-%d")
        start_date = reference_date - timedelta(days=request.lookback_days)
        
        # Buscar jogos no período na coleção "partidas"
        query = {
            "date": {
                "$gte": start_date.strftime("%Y-%m-%d"),
                "$lte": request.reference_date
            }
        }
        
        cursor = db.partidas.find(query)
        matches = await cursor.to_list(length=None)
        
        if not matches:
            return []
        
        # Extrair gatilhos de todos os jogos
        all_triggers = []
        for match in matches:
            triggers = extract_triggers_from_match(match, request.market)
            all_triggers.extend(triggers)
        
        if not all_triggers:
            return []
        
        # Calcular efetividade
        results = calculate_trigger_effectiveness(all_triggers)
        
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==================== ANÁLISE HISTÓRICA ====================

@analysis_router.post("/historical-trigger-analysis")
async def analyze_historical_triggers(request: HistoricalTriggerAnalysisRequest):
    """
    Analisa a efetividade de um mercado ao longo do tempo.
    """
    try:
        db = await get_database()
        
        # Buscar jogos no período na coleção "partidas"
        query = {
            "date": {
                "$gte": request.start_date,
                "$lte": request.end_date
            }
        }
        
        cursor = db.partidas.find(query).sort("date", 1)
        matches = await cursor.to_list(length=None)
        
        if not matches:
            return []
        
        # Agrupar por período
        period_data = {}
        
        for match in matches:
            date_str = match.get("date", "")
            if not date_str:
                continue
            
            # Determinar o período baseado na agregação
            if request.aggregation == "daily":
                period = date_str
            elif request.aggregation == "weekly":
                date_obj = datetime.strptime(date_str, "%Y-%m-%d")
                week_start = date_obj - timedelta(days=date_obj.weekday())
                period = week_start.strftime("%Y-%m-%d")
            elif request.aggregation == "monthly":
                period = date_str[:7]  # YYYY-MM
            else:
                period = date_str
            
            if period not in period_data:
                period_data[period] = {"total": 0, "successful": 0}
            
            # Verificar resultado do mercado
            if "markets" in match and request.market in match["markets"]:
                period_data[period]["total"] += 1
                if check_market_result(match, request.market):
                    period_data[period]["successful"] += 1
        
        # Converter para lista de resultados
        results = []
        for period, stats in sorted(period_data.items()):
            success_rate = stats["successful"] / stats["total"] if stats["total"] > 0 else 0
            results.append(HistoricalResult(
                period=period,
                total_matches=stats["total"],
                successful_matches=stats["successful"],
                success_rate=success_rate
            ))
        
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))




# ==================== ANÁLISE DE PADRÕES PREDITIVOS ====================

class PredictivePattern(BaseModel):
    """Padrão preditivo identificado"""
    pattern_type: str  # "placar_ht", "placar_ft", "market_odd"
    pattern_value: str
    frequency: int
    success_rate: float
    avg_odd: Optional[float] = None

class DailyPredictiveAnalysis(BaseModel):
    """Análise preditiva de um dia específico"""
    date: str
    total_matches: int
    successful_matches: int
    success_rate: float
    top_placar_ht: List[PredictivePattern]
    top_placar_ft: List[PredictivePattern]
    top_markets_odds: List[PredictivePattern]

class PredictiveAnalysisRequest(BaseModel):
    market: str
    reference_date: str
    lookback_days: int = 30
    top_n: int = 5  # Quantos padrões retornar

@analysis_router.post("/predictive-analysis")
async def analyze_predictive_patterns(request: PredictiveAnalysisRequest):
    """
    Analisa padrões preditivos para um mercado específico.
    
    Identifica os padrões mais frequentes (placares HT/FT, mercados/odds)
    que ocorrem antes do mercado alvo ganhar, agrupados por dia.
    
    Exemplo: Para "TotalGols_MaisDe_35", identifica:
    - Quais placares HT são mais comuns quando o mercado ganha
    - Quais placares FT são mais comuns
    - Quais outros mercados/odds são mais frequentes
    """
    try:
        db = await get_database()
        
        # Calcular data de início
        reference_date = datetime.strptime(request.reference_date, "%Y-%m-%d")
        start_date = reference_date - timedelta(days=request.lookback_days)
        
        # Buscar jogos no período
        query = {
            "date": {
                "$gte": start_date.strftime("%Y-%m-%d"),
                "$lte": request.reference_date
            }
        }
        
        cursor = db.partidas.find(query).sort("date", 1)
        matches = await cursor.to_list(length=None)
        
        if not matches:
            return []
        
        # Agrupar por data
        daily_analysis = {}
        
        for match in matches:
            date_str = match.get("date", "")
            if not date_str:
                continue
            
            # Verificar se o mercado alvo ganhou
            market_won = check_market_result(match, request.market)
            
            if date_str not in daily_analysis:
                daily_analysis[date_str] = {
                    "total": 0,
                    "successful": 0,
                    "placar_ht": {},
                    "placar_ft": {},
                    "markets_odds": {}
                }
            
            daily_analysis[date_str]["total"] += 1
            
            if market_won:
                daily_analysis[date_str]["successful"] += 1
                
                # Coletar padrões quando o mercado ganha
                placar_ht = match.get("placarHT", "")
                placar_ft = match.get("placarFT", "")
                
                if placar_ht:
                    if placar_ht not in daily_analysis[date_str]["placar_ht"]:
                        daily_analysis[date_str]["placar_ht"][placar_ht] = 0
                    daily_analysis[date_str]["placar_ht"][placar_ht] += 1
                
                if placar_ft:
                    if placar_ft not in daily_analysis[date_str]["placar_ft"]:
                        daily_analysis[date_str]["placar_ft"][placar_ft] = 0
                    daily_analysis[date_str]["placar_ft"][placar_ft] += 1
                
                # Coletar mercados e odds
                if "markets" in match:
                    for market_name, market_value in match["markets"].items():
                        # Incluir apenas mercados numéricos (odds)
                        if isinstance(market_value, (int, float)):
                            # Criar chave: "NomeMercado (odd)"
                            market_key = f"{market_name} ({market_value})"
                            
                            if market_key not in daily_analysis[date_str]["markets_odds"]:
                                daily_analysis[date_str]["markets_odds"][market_key] = {
                                    "count": 0,
                                    "odds": []
                                }
                            
                            daily_analysis[date_str]["markets_odds"][market_key]["count"] += 1
                            daily_analysis[date_str]["markets_odds"][market_key]["odds"].append(market_value)
        
        # Converter para lista de resultados
        results = []
        
        for date_str, data in sorted(daily_analysis.items()):
            if data["successful"] == 0:
                # Pular dias sem sucessos
                continue
            
            success_rate = data["successful"] / data["total"] if data["total"] > 0 else 0
            
            # Top placares HT
            top_placar_ht = []
            for placar, count in sorted(data["placar_ht"].items(), key=lambda x: x[1], reverse=True)[:request.top_n]:
                top_placar_ht.append(PredictivePattern(
                    pattern_type="placar_ht",
                    pattern_value=placar,
                    frequency=count,
                    success_rate=count / data["successful"] if data["successful"] > 0 else 0
                ))
            
            # Top placares FT
            top_placar_ft = []
            for placar, count in sorted(data["placar_ft"].items(), key=lambda x: x[1], reverse=True)[:request.top_n]:
                top_placar_ft.append(PredictivePattern(
                    pattern_type="placar_ft",
                    pattern_value=placar,
                    frequency=count,
                    success_rate=count / data["successful"] if data["successful"] > 0 else 0
                ))
            
            # Top mercados/odds
            top_markets_odds = []
            for market_key, market_data in sorted(data["markets_odds"].items(), key=lambda x: x[1]["count"], reverse=True)[:request.top_n]:
                avg_odd = sum(market_data["odds"]) / len(market_data["odds"]) if market_data["odds"] else 0
                
                top_markets_odds.append(PredictivePattern(
                    pattern_type="market_odd",
                    pattern_value=market_key,
                    frequency=market_data["count"],
                    success_rate=market_data["count"] / data["successful"] if data["successful"] > 0 else 0,
                    avg_odd=avg_odd
                ))
            
            results.append(DailyPredictiveAnalysis(
                date=date_str,
                total_matches=data["total"],
                successful_matches=data["successful"],
                success_rate=success_rate,
                top_placar_ht=top_placar_ht,
                top_placar_ft=top_placar_ft,
                top_markets_odds=top_markets_odds
            ))
        
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    

# No arquivo analysis_routes.py, adicione esta rota:

@analysis_router.get("/teams")
async def get_all_teams(db = Depends(get_db)):
    """
    Retorna lista de todos os times únicos do banco de dados
    """
    try:
        # Buscar times únicos dos campos timeCasa e timeFora
        pipeline = [
            {
                "$group": {
                    "_id": None,
                    "home_teams": {"$addToSet": "$timeCasa"},
                    "away_teams": {"$addToSet": "$timeFora"}
                }
            },
            {
                "$project": {
                    "all_teams": {"$setUnion": ["$home_teams", "$away_teams"]}
                }
            }
        ]
        
        result = await db.partidas.aggregate(pipeline).to_list(length=1)
        
        if result and 'all_teams' in result[0]:
            teams = [team for team in result[0]['all_teams'] if team]  # Remove valores None/vazios
            teams.sort()
            return {"teams": teams}
        else:
            return {"teams": []}
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao buscar times: {str(e)}")

@analysis_router.post("/predictive-summary")
async def get_predictive_summary(request: PredictiveAnalysisRequest):
    """
    Retorna um resumo consolidado dos padrões preditivos de todo o período.
    
    Agrega os padrões de todos os dias e retorna os mais frequentes globalmente.
    """
    try:
        db = await get_database()
        
        # Calcular data de início
        reference_date = datetime.strptime(request.reference_date, "%Y-%m-%d")
        start_date = reference_date - timedelta(days=request.lookback_days)
        
        # Buscar jogos no período
        query = {
            "date": {
                "$gte": start_date.strftime("%Y-%m-%d"),
                "$lte": request.reference_date
            }
        }
        
        cursor = db.partidas.find(query)
        matches = await cursor.to_list(length=None)
        
        if not matches:
            return {
                "total_matches": 0,
                "successful_matches": 0,
                "success_rate": 0,
                "top_placar_ht": [],
                "top_placar_ft": [],
                "top_markets_odds": []
            }
        
        # Coletar padrões globalmente
        total_matches = 0
        successful_matches = 0
        placar_ht_global = {}
        placar_ft_global = {}
        markets_odds_global = {}
        
        for match in matches:
            # Verificar se o mercado alvo ganhou
            market_won = check_market_result(match, request.market)
            
            total_matches += 1
            
            if market_won:
                successful_matches += 1
                
                # Coletar padrões quando o mercado ganha
                placar_ht = match.get("placarHT", "")
                placar_ft = match.get("placarFT", "")
                
                if placar_ht:
                    if placar_ht not in placar_ht_global:
                        placar_ht_global[placar_ht] = 0
                    placar_ht_global[placar_ht] += 1
                
                if placar_ft:
                    if placar_ft not in placar_ft_global:
                        placar_ft_global[placar_ft] = 0
                    placar_ft_global[placar_ft] += 1
                
                # Coletar mercados e odds
                if "markets" in match:
                    for market_name, market_value in match["markets"].items():
                        # Incluir apenas mercados numéricos (odds)
                        if isinstance(market_value, (int, float)):
                            # Agrupar por nome do mercado (sem odd específica)
                            if market_name not in markets_odds_global:
                                markets_odds_global[market_name] = {
                                    "count": 0,
                                    "odds": []
                                }
                            
                            markets_odds_global[market_name]["count"] += 1
                            markets_odds_global[market_name]["odds"].append(market_value)
        
        success_rate = successful_matches / total_matches if total_matches > 0 else 0
        
        # Top placares HT
        top_placar_ht = []
        for placar, count in sorted(placar_ht_global.items(), key=lambda x: x[1], reverse=True)[:request.top_n]:
            top_placar_ht.append(PredictivePattern(
                pattern_type="placar_ht",
                pattern_value=placar,
                frequency=count,
                success_rate=count / successful_matches if successful_matches > 0 else 0
            ))
        
        # Top placares FT
        top_placar_ft = []
        for placar, count in sorted(placar_ft_global.items(), key=lambda x: x[1], reverse=True)[:request.top_n]:
            top_placar_ft.append(PredictivePattern(
                pattern_type="placar_ft",
                pattern_value=placar,
                frequency=count,
                success_rate=count / successful_matches if successful_matches > 0 else 0
            ))
        
        # Top mercados/odds
        top_markets_odds = []
        for market_name, market_data in sorted(markets_odds_global.items(), key=lambda x: x[1]["count"], reverse=True)[:request.top_n]:
            avg_odd = sum(market_data["odds"]) / len(market_data["odds"]) if market_data["odds"] else 0
            min_odd = min(market_data["odds"]) if market_data["odds"] else 0
            max_odd = max(market_data["odds"]) if market_data["odds"] else 0
            
            top_markets_odds.append(PredictivePattern(
                pattern_type="market_odd",
                pattern_value=f"{market_name} (média: {avg_odd:.2f}, min: {min_odd:.2f}, max: {max_odd:.2f})",
                frequency=market_data["count"],
                success_rate=market_data["count"] / successful_matches if successful_matches > 0 else 0,
                avg_odd=avg_odd
            ))
        
        return {
            "total_matches": total_matches,
            "successful_matches": successful_matches,
            "success_rate": success_rate,
            "top_placar_ht": top_placar_ht,
            "top_placar_ft": top_placar_ft,
            "top_markets_odds": top_markets_odds
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))