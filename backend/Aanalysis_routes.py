"""
analysis_routes.py - Versão Atualizada para Coleção "partidas"

Versão adaptada para trabalhar com a estrutura real dos dados:
- Coleção: "partidas" (não "matches")
- Markets: valores numéricos (odds) em vez de "green"/"red"
- Análise baseada em resultados reais das partidas
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
    """
    try:
        db = await get_database()
        
        # Buscar um jogo de exemplo para extrair os mercados
        sample_match = await db.partidas.find_one({})
        
        if not sample_match or "markets" not in sample_match:
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
    Retorna as datas disponíveis nos dados (mais antiga e mais recente).
    """
    try:
        db = await get_database()
        
        # Buscar data mais antiga e mais recente
        oldest_match = await db.partidas.find_one({}, sort=[("date", 1)])
        newest_match = await db.partidas.find_one({}, sort=[("date", -1)])
        
        if not oldest_match or not newest_match:
            return {
                "oldest_date": None,
                "newest_date": None,
                "message": "Nenhuma data disponível"
            }
        
        return {
            "oldest_date": oldest_match.get("date"),
            "newest_date": newest_match.get("date"),
            "message": "Datas disponíveis"
        }
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
        threshold = float(market.split("_")[-1].replace("05", "0.5").replace("15", "1.5").replace("25", "2.5").replace("35", "3.5").replace("45", "4.5"))
        return total_gols > threshold
    
    elif "TotalGols_MenosDe_" in market:
        threshold = float(market.split("_")[-1].replace("05", "0.5").replace("15", "1.5").replace("25", "2.5").replace("35", "3.5").replace("45", "4.5"))
        return total_gols < threshold
    
    # Análise de Vencedor
    elif market == "VencedorFT_Casa":
        return placar_casa > placar_fora
    
    elif market == "VencedorFT_Visitante":
        return placar_fora > placar_casa
    
    elif market == "VencedorFT_Empate":
        return placar_casa == placar_fora
    
    # Análise de Gols Exatos
    elif "GolsExatos_" in market:
        if market == "GolsExatos_5_Mais":
            return total_gols >= 5
        else:
            gols_exatos = int(market.split("_")[-1])
            return total_gols == gols_exatos
    
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
        if market == "MargemVitoriaGols_Casa1":
            return (placar_casa - placar_fora) == 1
        elif market == "MargemVitoriaGols_Casa2":
            return (placar_casa - placar_fora) == 2
        elif market == "MargemVitoriaGols_Casa3Mais":
            return (placar_casa - placar_fora) >= 3
    
    elif "MargemVitoriaGols_Visitante" in market:
        if market == "MargemVitoriaGols_Visitante1":
            return (placar_fora - placar_casa) == 1
        elif market == "MargemVitoriaGols_Visitante2":
            return (placar_fora - placar_casa) == 2
        elif market == "MargemVitoriaGols_Visitante3Mais":
            return (placar_fora - placar_casa) >= 3
    
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

