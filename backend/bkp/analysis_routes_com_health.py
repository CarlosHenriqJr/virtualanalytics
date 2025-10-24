"""
analysis_routes.py - Rotas de Análise com Health Check

Versão atualizada com endpoint de health check para verificar
a conexão com o MongoDB e o status dos dados.
"""

from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from datetime import datetime, timedelta
from pydantic import BaseModel
from database import get_database

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
        # Tentar contar documentos na coleção matches
        total_matches = await db.matches.count_documents({})
        
        # Buscar data mais antiga e mais recente
        oldest_match = await db.matches.find_one({}, sort=[("date", 1)])
        newest_match = await db.matches.find_one({}, sort=[("date", -1)])
        
        return {
            "status": "connected",
            "database": "MongoDB",
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
    """
    try:
        db = await get_database()
        
        # Buscar um jogo de exemplo para extrair os mercados
        sample_match = await db.matches.find_one({})
        
        if not sample_match or "markets" not in sample_match:
            return {"markets": []}
        
        # Extrair nomes dos mercados
        markets = list(sample_match["markets"].keys())
        markets.sort()
        
        return {"markets": markets}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

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
        
        # Buscar jogos
        cursor = db.matches.find(query).sort("date", -1).limit(limit)
        matches = await cursor.to_list(length=limit)
        
        # Converter ObjectId para string
        for match in matches:
            if "_id" in match:
                match["_id"] = str(match["_id"])
        
        return matches
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==================== ANÁLISE DE GATILHOS ====================

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
    
    market_result = match["markets"][market]
    placar_ht = match.get("placarHT", "")
    
    if not placar_ht:
        return triggers
    
    try:
        gols_casa_ht, gols_fora_ht = map(int, placar_ht.split("-"))
        total_gols_ht = gols_casa_ht + gols_fora_ht
        
        # Gatilho 1: Placar exato no HT
        triggers.append({
            "name": f"Placar HT: {placar_ht}",
            "type": "exact_score_ht",
            "value": placar_ht,
            "success": market_result == "green"
        })
        
        # Gatilho 2: Total de gols no HT
        triggers.append({
            "name": f"Total de gols HT: {total_gols_ht}",
            "type": "total_goals_ht",
            "value": total_gols_ht,
            "success": market_result == "green"
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
            "success": market_result == "green"
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
            "success": market_result == "green"
        })
        
    except (ValueError, AttributeError):
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
        
        # Buscar jogos no período
        query = {
            "date": {
                "$gte": start_date.strftime("%Y-%m-%d"),
                "$lte": request.reference_date
            }
        }
        
        cursor = db.matches.find(query)
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
        
        # Buscar jogos no período
        query = {
            "date": {
                "$gte": request.start_date,
                "$lte": request.end_date
            }
        }
        
        cursor = db.matches.find(query).sort("date", 1)
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
                if match["markets"][request.market] == "green":
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

