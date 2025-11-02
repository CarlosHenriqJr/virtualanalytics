"""
unified_trigger_system.py - Sistema Unificado de Gatilhos com Multi-Mercado

Funcionalidades:
1. Análise e teste de gatilhos antes de salvar
2. Multi-mercado com filtros de odds
3. Salvamento automático em cache após análise
4. Análise cruzada usando dados salvos
5. Atualização incremental de cache
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from database import get_database
from bson import ObjectId
import statistics

unified_router = APIRouter(prefix="/unified-triggers", tags=["unified-triggers"])

# ==================== MODELOS ====================

class MarketConfig(BaseModel):
    """Configuração de um mercado"""
    name: str
    odds_min: Optional[float] = None
    odds_max: Optional[float] = None

class TriggerTestRequest(BaseModel):
    """Requisição para testar um gatilho (antes de salvar)"""
    name: str
    description: Optional[str] = None
    trigger_condition: Dict[str, Any]
    markets: List[MarketConfig]  # Múltiplos mercados
    market_logic: str = "ANY"  # "ANY" ou "ALL"
    skip_games: int = 0
    max_attempts: int = 3
    start_date: str
    end_date: str

class TriggerSaveRequest(BaseModel):
    """Salvar gatilho após teste bem-sucedido"""
    test_data: TriggerTestRequest
    auto_update_cache: bool = True

class TriggerUpdateCacheRequest(BaseModel):
    """Atualizar cache de gatilho específico"""
    trigger_id: str
    start_date: Optional[str] = None
    end_date: Optional[str] = None

# ==================== FUNÇÕES DE VALIDAÇÃO ====================

def check_trigger_condition(match: dict, condition: Dict[str, Any]) -> tuple[bool, str]:
    """Verifica se partida atende condição"""
    for key, value in condition.items():
        if key not in match:
            return False, f"Campo '{key}' ausente"
        
        match_value = match[key]
        
        if isinstance(value, dict):
            for operator, op_value in value.items():
                if operator == "$lte" and not (match_value <= op_value):
                    return False, f"{key}={match_value} > {op_value}"
                elif operator == "$gte" and not (match_value >= op_value):
                    return False, f"{key}={match_value} < {op_value}"
                elif operator == "$lt" and not (match_value < op_value):
                    return False, f"{key}={match_value} >= {op_value}"
                elif operator == "$gt" and not (match_value > op_value):
                    return False, f"{key}={match_value} <= {op_value}"
                elif operator == "$ne" and not (match_value != op_value):
                    return False, f"{key}={match_value} == {op_value}"
                elif operator == "$in" and match_value not in op_value:
                    return False, f"{key}={match_value} não está em {op_value}"
        else:
            if match_value != value:
                return False, f"{key}={match_value} != {value}"
    
    return True, "OK"

def check_market_with_odds(match: dict, market_config: MarketConfig) -> tuple[bool, float, str]:
    """
    Verifica mercado E valida odds.
    
    Retorna: (sucesso: bool, odd: float, info: str)
    """
    market_name = market_config.name
    total_gols = match.get("totalGolsFT", 0)
    
    # Verificar resultado do mercado
    market_success = False
    
    if "MaisDe_35" in market_name or "Over_3_5" in market_name:
        market_success = total_gols > 3.5
    elif "MaisDe_25" in market_name or "Over_2_5" in market_name:
        market_success = total_gols > 2.5
    elif "MaisDe_45" in market_name or "Over_4_5" in market_name:
        market_success = total_gols > 4.5
    elif "MaisDe_15" in market_name or "Over_1_5" in market_name:
        market_success = total_gols > 1.5
    elif "AmbasMarcam" in market_name or "BTTS" in market_name:
        casa = match.get("placarCasaFT", 0)
        fora = match.get("placarForaFT", 0)
        market_success = casa > 0 and fora > 0
    
    # Buscar odd do mercado
    markets = match.get("markets", {})
    odd = markets.get(market_name, 0)
    
    # Validar filtro de odds
    if market_config.odds_min and odd < market_config.odds_min:
        return False, odd, f"Odd {odd} < {market_config.odds_min}"
    
    if market_config.odds_max and odd > market_config.odds_max:
        return False, odd, f"Odd {odd} > {market_config.odds_max}"
    
    info = f"{'✓' if market_success else '✗'} {market_name}: {total_gols} gols, odd={odd}"
    
    return market_success, odd, info

def calculate_multi_market_performance(
    matches: List[dict],
    trigger_condition: Dict[str, Any],
    market_configs: List[MarketConfig],
    market_logic: str,
    skip_games: int,
    max_attempts: int
) -> Dict[str, Any]:
    """
    Calcula performance com MÚLTIPLOS mercados e filtros de odds.
    
    market_logic:
    - "ANY": pelo menos 1 mercado green = sucesso
    - "ALL": todos os mercados green = sucesso
    """
    
    gale_breakdown = {f"G{i}": 0 for i in range(max_attempts)}
    gale_breakdown["SG"] = 0
    
    current_skip = 0
    current_sequence = []
    total_green = 0
    total_red = 0
    total_stake = 0
    total_profit = 0
    
    market_stats = {mc.name: {"greens": 0, "reds": 0, "total_odd": 0, "count": 0} for mc in market_configs}
    
    operations_detail = []
    
    for match in matches:
        if current_skip > 0:
            current_skip -= 1
            continue
        
        # Verificar condição do gatilho
        condition_met, _ = check_trigger_condition(match, trigger_condition)
        if not condition_met:
            continue
        
        # Verificar TODOS os mercados configurados
        market_results = []
        market_odds = []
        
        for market_config in market_configs:
            success, odd, info = check_market_with_odds(match, market_config)
            
            # Se odd não passa no filtro, pular esta partida
            if odd == 0 or (market_config.odds_min and odd < market_config.odds_min) or \
               (market_config.odds_max and odd > market_config.odds_max):
                continue
            
            market_results.append(success)
            market_odds.append(odd)
            
            # Estatísticas por mercado
            if success:
                market_stats[market_config.name]["greens"] += 1
            else:
                market_stats[market_config.name]["reds"] += 1
            market_stats[market_config.name]["total_odd"] += odd
            market_stats[market_config.name]["count"] += 1
        
        # Se nenhum mercado passou no filtro de odds, pular
        if not market_results:
            continue
        
        # Aplicar lógica de mercado
        if market_logic == "ANY":
            operation_success = any(market_results)
        else:  # ALL
            operation_success = all(market_results)
        
        # Calcular odd da operação (média das odds dos mercados)
        avg_odd = sum(market_odds) / len(market_odds) if market_odds else 1.0
        
        # Calcular stake no Gale atual
        if current_sequence:
            gale_level = len(current_sequence) - 1
            stake = 1 * (2 ** gale_level)  # Martingale simples
        else:
            stake = 1
        
        total_stake += stake
        
        if operation_success:
            # GREEN
            profit = stake * (avg_odd - 1)
            total_profit += profit
            
            if current_sequence:
                gale_level_key = f"G{len(current_sequence) - 1}"
                gale_breakdown[gale_level_key] += 1
            else:
                gale_breakdown["SG"] += 1
            
            total_green += 1
            current_sequence = []
            current_skip = skip_games
            
            operations_detail.append({
                "date": match.get("date"),
                "time": match.get("hour"),
                "teams": f"{match.get('timeCasa')} x {match.get('timeFora')}",
                "result": "GREEN",
                "gale_level": len(current_sequence) if current_sequence else 0,
                "stake": stake,
                "odd": round(avg_odd, 2),
                "profit": round(profit, 2)
            })
        else:
            # RED
            total_profit -= stake
            current_sequence.append(match)
            
            if len(current_sequence) >= max_attempts:
                total_red += 1
                current_sequence = []
                current_skip = 0
                
                operations_detail.append({
                    "date": match.get("date"),
                    "time": match.get("hour"),
                    "teams": f"{match.get('timeCasa')} x {match.get('timeFora')}",
                    "result": "RED",
                    "gale_level": max_attempts,
                    "stake": stake,
                    "odd": 0,
                    "profit": round(-stake, 2)
                })
    
    # Processar sequências pendentes
    if current_sequence:
        total_red += 1
    
    total_operations = total_green + total_red
    success_rate = (total_green / total_operations * 100) if total_operations > 0 else 0
    roi = (total_profit / total_stake * 100) if total_stake > 0 else 0
    
    # Estatísticas de cada mercado
    market_performance = {}
    for market_name, stats in market_stats.items():
        if stats["count"] > 0:
            market_performance[market_name] = {
                "greens": stats["greens"],
                "reds": stats["reds"],
                "success_rate": round((stats["greens"] / stats["count"]) * 100, 2),
                "avg_odd": round(stats["total_odd"] / stats["count"], 2)
            }
    
    return {
        "greens": total_green,
        "reds": total_red,
        "total_operations": total_operations,
        "success_rate": round(success_rate, 2),
        "gale_breakdown": gale_breakdown,
        "total_stake": round(total_stake, 2),
        "total_profit": round(total_profit, 2),
        "roi": round(roi, 2),
        "market_performance": market_performance,
        "operations_detail": operations_detail[-50:]  # Últimas 50 operações
    }

# ==================== ENDPOINTS ====================

@unified_router.post("/test-trigger")
async def test_trigger(request: TriggerTestRequest):
    """
    PASSO 1: Testar um gatilho antes de salvar.
    
    Retorna análise completa para o usuário decidir se salva.
    """
    try:
        db = await get_database()
        
        print(f"\n🧪 Testando gatilho: {request.name}")
        print(f"   Mercados: {[m.name for m in request.markets]}")
        print(f"   Lógica: {request.market_logic}")
        print(f"   Período: {request.start_date} a {request.end_date}")
        
        # Buscar partidas do período
        matches = await db.partidas.find({
            "date": {"$gte": request.start_date, "$lte": request.end_date}
        }).sort([("date", 1), ("hour", 1)]).to_list(None)
        
        if not matches:
            return {
                "success": False,
                "message": "Nenhuma partida encontrada no período",
                "should_save": False
            }
        
        print(f"   📊 {len(matches)} partidas analisadas")
        
        # Calcular performance
        stats = calculate_multi_market_performance(
            matches,
            request.trigger_condition,
            request.markets,
            request.market_logic,
            request.skip_games,
            request.max_attempts
        )
        
        print(f"   ✅ G:{stats['greens']} R:{stats['reds']} | Taxa:{stats['success_rate']}% | ROI:{stats['roi']}%")
        
        # Decisão: vale a pena salvar?
        should_save = (
            stats["success_rate"] >= 60 and  # Pelo menos 60% de acerto
            stats["total_operations"] >= 20 and  # Pelo menos 20 operações
            stats["roi"] > 0  # ROI positivo
        )
        
        recommendation = ""
        if should_save:
            recommendation = "✅ Gatilho promissor! Recomendo salvar."
        elif stats["total_operations"] < 20:
            recommendation = "⚠️ Poucas operações. Teste em período maior."
        elif stats["success_rate"] < 60:
            recommendation = "❌ Taxa de acerto baixa. Ajuste a condição."
        elif stats["roi"] <= 0:
            recommendation = "❌ ROI negativo. Revise os filtros de odds."
        
        return {
            "success": True,
            "statistics": stats,
            "should_save": should_save,
            "recommendation": recommendation,
            "trigger_config": request.dict()
        }
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(500, f"Erro no teste: {str(e)}")

@unified_router.post("/save-trigger")
async def save_trigger(request: TriggerSaveRequest):
    """
    PASSO 2: Salvar gatilho após teste bem-sucedido.
    
    Opcionalmente atualiza cache automaticamente.
    """
    try:
        db = await get_database()
        
        # Verificar se já existe
        existing = await db.triggers.find_one({"name": request.test_data.name})
        if existing:
            raise HTTPException(400, "Já existe um gatilho com este nome")
        
        # Salvar gatilho
        trigger_doc = {
            "name": request.test_data.name,
            "description": request.test_data.description,
            "trigger_condition": request.test_data.trigger_condition,
            "markets": [m.dict() for m in request.test_data.markets],
            "market_logic": request.test_data.market_logic,
            "skip_games": request.test_data.skip_games,
            "max_attempts": request.test_data.max_attempts,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        }
        
        result = await db.triggers.insert_one(trigger_doc)
        trigger_id = str(result.inserted_id)
        
        print(f"✅ Gatilho '{request.test_data.name}' salvo: {trigger_id}")
        
        # Atualizar cache automaticamente
        if request.auto_update_cache:
            print(f"🔄 Atualizando cache...")
            
            # Buscar partidas
            matches = await db.partidas.find({
                "date": {
                    "$gte": request.test_data.start_date,
                    "$lte": request.test_data.end_date
                }
            }).sort([("date", 1), ("hour", 1)]).to_list(None)
            
            # Agrupar por data
            by_date = {}
            for m in matches:
                d = m.get("date")
                if d:
                    by_date.setdefault(d, []).append(m)
            
            # Calcular e salvar cache para cada dia
            cache_count = 0
            for date, day_matches in by_date.items():
                stats = calculate_multi_market_performance(
                    day_matches,
                    request.test_data.trigger_condition,
                    request.test_data.markets,
                    request.test_data.market_logic,
                    request.test_data.skip_games,
                    request.test_data.max_attempts
                )
                
                cache_doc = {
                    "trigger_id": trigger_id,
                    "trigger_name": request.test_data.name,
                    "date": date,
                    **stats,
                    "computed_at": datetime.now().isoformat()
                }
                
                await db.trigger_daily_cache.update_one(
                    {"trigger_id": trigger_id, "date": date},
                    {"$set": cache_doc},
                    upsert=True
                )
                cache_count += 1
            
            print(f"✅ Cache atualizado: {cache_count} dias")
        
        return {
            "success": True,
            "trigger_id": trigger_id,
            "message": f"Gatilho salvo com sucesso{' e cache atualizado' if request.auto_update_cache else ''}",
            "cache_updated": request.auto_update_cache
        }
        
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(500, f"Erro ao salvar: {str(e)}")

@unified_router.post("/update-trigger-cache")
async def update_trigger_cache(request: TriggerUpdateCacheRequest):
    """
    PASSO 3: Atualizar cache de um gatilho específico.
    
    Usado quando há novos dados ou gatilho foi modificado.
    """
    try:
        db = await get_database()
        
        # Buscar gatilho
        trigger = await db.triggers.find_one({"_id": ObjectId(request.trigger_id)})
        if not trigger:
            raise HTTPException(404, "Gatilho não encontrado")
        
        # Definir período
        end_date = request.end_date or datetime.now().strftime("%Y-%m-%d")
        
        if request.start_date:
            start_date = request.start_date
        else:
            # Buscar última data no cache
            last = await db.trigger_daily_cache.find_one(
                {"trigger_id": request.trigger_id},
                sort=[("date", -1)]
            )
            if last:
                start_date = (datetime.strptime(last["date"], "%Y-%m-%d") + timedelta(1)).strftime("%Y-%m-%d")
            else:
                start_date = (datetime.now() - timedelta(30)).strftime("%Y-%m-%d")
        
        print(f"🔄 Atualizando cache: {trigger['name']}")
        print(f"   Período: {start_date} a {end_date}")
        
        # Buscar partidas
        matches = await db.partidas.find({
            "date": {"$gte": start_date, "$lte": end_date}
        }).sort([("date", 1), ("hour", 1)]).to_list(None)
        
        if not matches:
            return {
                "success": True,
                "message": "Nenhuma partida nova para processar",
                "dates_updated": 0
            }
        
        # Agrupar por data e processar
        by_date = {}
        for m in matches:
            d = m.get("date")
            if d:
                by_date.setdefault(d, []).append(m)
        
        # Reconstruir market configs
        markets = [MarketConfig(**m) for m in trigger["markets"]]
        
        cache_count = 0
        for date, day_matches in by_date.items():
            stats = calculate_multi_market_performance(
                day_matches,
                trigger["trigger_condition"],
                markets,
                trigger["market_logic"],
                trigger["skip_games"],
                trigger["max_attempts"]
            )
            
            cache_doc = {
                "trigger_id": request.trigger_id,
                "trigger_name": trigger["name"],
                "date": date,
                **stats,
                "computed_at": datetime.now().isoformat()
            }
            
            await db.trigger_daily_cache.update_one(
                {"trigger_id": request.trigger_id, "date": date},
                {"$set": cache_doc},
                upsert=True
            )
            cache_count += 1
        
        print(f"✅ {cache_count} dias atualizados")
        
        return {
            "success": True,
            "message": f"Cache atualizado com sucesso",
            "dates_updated": cache_count,
            "period": {"start": start_date, "end": end_date}
        }
        
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(500, f"Erro ao atualizar: {str(e)}")

@unified_router.get("/list-saved-triggers")
async def list_saved_triggers():
    """Lista todos os gatilhos salvos com estatísticas resumidas"""
    try:
        db = await get_database()
        
        triggers = await db.triggers.find({}).sort([("created_at", -1)]).to_list(None)
        
        result = []
        for trigger in triggers:
            trigger_id = str(trigger["_id"])
            
            # Buscar estatísticas do cache
            pipeline = [
                {"$match": {"trigger_id": trigger_id}},
                {"$group": {
                    "_id": None,
                    "total_dates": {"$sum": 1},
                    "total_greens": {"$sum": "$greens"},
                    "total_reds": {"$sum": "$reds"},
                    "avg_success_rate": {"$avg": "$success_rate"},
                    "total_roi": {"$sum": "$roi"},
                    "last_date": {"$max": "$date"}
                }}
            ]
            
            stats_result = await db.trigger_daily_cache.aggregate(pipeline).to_list(1)
            
            if stats_result:
                stats = stats_result[0]
                result.append({
                    "id": trigger_id,
                    "name": trigger["name"],
                    "description": trigger.get("description"),
                    "markets": trigger["markets"],
                    "market_logic": trigger["market_logic"],
                    "created_at": trigger["created_at"],
                    "cache_stats": {
                        "days_analyzed": stats["total_dates"],
                        "total_greens": stats["total_greens"],
                        "total_reds": stats["total_reds"],
                        "avg_success_rate": round(stats["avg_success_rate"], 2),
                        "total_roi": round(stats["total_roi"], 2),
                        "last_date": stats["last_date"]
                    }
                })
            else:
                result.append({
                    "id": trigger_id,
                    "name": trigger["name"],
                    "description": trigger.get("description"),
                    "markets": trigger["markets"],
                    "market_logic": trigger["market_logic"],
                    "created_at": trigger["created_at"],
                    "cache_stats": None
                })
        
        return {
            "success": True,
            "triggers": result,
            "total": len(result)
        }
        
    except Exception as e:
        raise HTTPException(500, f"Erro ao listar: {str(e)}")