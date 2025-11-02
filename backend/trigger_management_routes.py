"""
trigger_management_routes.py - Gerenciamento e Cruzamento de Gatilhos

Funcionalidades:
1. Salvar/Editar/Excluir gatilhos personalizados
2. Listar gatilhos salvos
3. Análise cruzada de desempenho entre gatilhos
4. Detecção de reversão de performance
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from database import get_database
from bson import ObjectId
import statistics

trigger_router = APIRouter(prefix="/trigger-management", tags=["trigger-management"])

# ==================== MODELOS ====================

class TriggerCreate(BaseModel):
    """Modelo para criar um gatilho"""
    name: str
    description: Optional[str] = None
    trigger_condition: Dict[str, Any]  # Ex: {"IntervaloVencedor": "Visitante"}
    target_market: str = "TotalGols_MaisDe_35"
    skip_games: int = 0
    max_attempts: int = 3

class TriggerUpdate(BaseModel):
    """Modelo para atualizar um gatilho"""
    name: Optional[str] = None
    description: Optional[str] = None
    trigger_condition: Optional[Dict[str, Any]] = None
    target_market: Optional[str] = None
    skip_games: Optional[int] = None
    max_attempts: Optional[int] = None

class TriggerCrossAnalysisRequest(BaseModel):
    """Modelo para análise cruzada"""
    trigger_ids: List[str]  # Lista de IDs dos gatilhos
    start_date: str
    end_date: str
    include_reversal_analysis: bool = True

class DailyTriggerPerformance(BaseModel):
    """Desempenho de um gatilho em um dia"""
    date: str
    trigger_id: str
    trigger_name: str
    greens: int
    reds: int
    total_operations: int
    success_rate: float
    gale_breakdown: Dict[str, int]

class ReversalPattern(BaseModel):
    """Padrão de reversão detectado"""
    date: str
    trigger_poor: str  # Gatilho com performance ruim
    trigger_good: str  # Gatilho com boa performance no dia seguinte
    poor_success_rate: float
    good_success_rate: float
    reversal_strength: float  # Força da reversão (0-100)

# ==================== FUNÇÕES AUXILIARES ====================

def check_trigger_condition(match: dict, condition: Dict[str, Any]) -> bool:
    """
    Verifica se uma partida atende a condição do gatilho.
    
    Exemplos de condições:
    - {"IntervaloVencedor": "Visitante"}
    - {"placarHT": "0-0"}
    - {"posicaoMandante": {"$lte": 5}}
    """
    for key, value in condition.items():
        if key not in match:
            return False
        
        # Se o valor é um dicionário, é uma condição especial (ex: $lte, $gte)
        if isinstance(value, dict):
            match_value = match[key]
            for operator, op_value in value.items():
                if operator == "$lte" and not (match_value <= op_value):
                    return False
                elif operator == "$gte" and not (match_value >= op_value):
                    return False
                elif operator == "$lt" and not (match_value < op_value):
                    return False
                elif operator == "$gt" and not (match_value > op_value):
                    return False
                elif operator == "$ne" and not (match_value != op_value):
                    return False
        else:
            # Comparação simples
            if match[key] != value:
                return False
    
    return True

def check_market_result(match: dict, market: str) -> bool:
    """Verifica se um mercado específico foi bem-sucedido"""
    if market == "TotalGols_MaisDe_35":
        return match.get("totalGolsFT", 0) > 3.5
    elif market == "TotalGols_MaisDe_25":
        return match.get("totalGolsFT", 0) > 2.5
    elif market == "TotalGols_MaisDe_45":
        return match.get("totalGolsFT", 0) > 4.5
    elif market == "ParaOTimeMarcarSimNao_AmbasMarcam":
        return match.get("placarCasaFT", 0) > 0 and match.get("placarForaFT", 0) > 0
    return False

def calculate_trigger_performance(matches: List[dict], trigger: dict) -> Dict[str, Any]:
    """
    Calcula o desempenho de um gatilho em uma lista de partidas.
    
    Retorna estatísticas de Greens, Reds e breakdown por Gale.
    """
    condition = trigger["trigger_condition"]
    target_market = trigger["target_market"]
    skip_games = trigger.get("skip_games", 0)
    max_attempts = trigger.get("max_attempts", 3)
    
    gale_breakdown = {f"G{i}": 0 for i in range(max_attempts)}
    gale_breakdown["SG"] = 0
    
    current_skip = 0
    current_sequence = []
    total_green = 0
    total_red = 0
    
    for match in matches:
        # Verificar se estamos em período de skip
        if current_skip > 0:
            current_skip -= 1
            continue
        
        # Verificar se a partida atende ao gatilho
        if not check_trigger_condition(match, condition):
            continue
        
        # Verificar resultado do mercado
        market_won = check_market_result(match, target_market)
        
        if market_won:
            # Acertou - registrar sucesso no Gale atual
            if current_sequence:
                gale_level = f"G{len(current_sequence) - 1}"
                gale_breakdown[gale_level] += 1
            else:
                gale_breakdown["SG"] += 1
            
            total_green += 1
            current_sequence = []
            current_skip = skip_games
            
        else:
            # Errou - adicionar à sequência atual
            current_sequence.append(match)
            
            # Verificar se atingiu o máximo de Gales
            if len(current_sequence) >= max_attempts:
                total_red += 1
                current_sequence = []
                current_skip = 0
    
    # Processar sequências pendentes
    if current_sequence:
        total_red += 1
    
    total_operations = total_green + total_red
    success_rate = (total_green / total_operations * 100) if total_operations > 0 else 0
    
    return {
        "greens": total_green,
        "reds": total_red,
        "total_operations": total_operations,
        "success_rate": round(success_rate, 2),
        "gale_breakdown": gale_breakdown
    }

# ==================== ENDPOINTS: GERENCIAMENTO DE GATILHOS ====================

@trigger_router.post("/triggers")
async def create_trigger(trigger: TriggerCreate):
    """Cria um novo gatilho personalizado"""
    try:
        db = await get_database()
        
        # Verificar se já existe um gatilho com o mesmo nome
        existing = await db.triggers.find_one({"name": trigger.name})
        if existing:
            raise HTTPException(status_code=400, detail="Já existe um gatilho com este nome")
        
        trigger_doc = {
            **trigger.dict(),
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        }
        
        result = await db.triggers.insert_one(trigger_doc)
        
        return {
            "success": True,
            "trigger_id": str(result.inserted_id),
            "message": "Gatilho criado com sucesso"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao criar gatilho: {str(e)}")

@trigger_router.get("/triggers")
async def list_triggers():
    """Lista todos os gatilhos salvos"""
    try:
        db = await get_database()
        
        cursor = db.triggers.find({}).sort([("created_at", -1)])
        triggers = await cursor.to_list(length=None)
        
        # Converter ObjectId para string
        for trigger in triggers:
            trigger["_id"] = str(trigger["_id"])
        
        return {
            "success": True,
            "triggers": triggers,
            "total": len(triggers)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao listar gatilhos: {str(e)}")

@trigger_router.get("/triggers/{trigger_id}")
async def get_trigger(trigger_id: str):
    """Obtém detalhes de um gatilho específico"""
    try:
        db = await get_database()
        
        trigger = await db.triggers.find_one({"_id": ObjectId(trigger_id)})
        
        if not trigger:
            raise HTTPException(status_code=404, detail="Gatilho não encontrado")
        
        trigger["_id"] = str(trigger["_id"])
        
        return {
            "success": True,
            "trigger": trigger
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao obter gatilho: {str(e)}")

@trigger_router.put("/triggers/{trigger_id}")
async def update_trigger(trigger_id: str, update: TriggerUpdate):
    """Atualiza um gatilho existente"""
    try:
        db = await get_database()
        
        # Verificar se o gatilho existe
        existing = await db.triggers.find_one({"_id": ObjectId(trigger_id)})
        if not existing:
            raise HTTPException(status_code=404, detail="Gatilho não encontrado")
        
        # Preparar dados de atualização (apenas campos não-nulos)
        update_data = {k: v for k, v in update.dict().items() if v is not None}
        update_data["updated_at"] = datetime.now().isoformat()
        
        await db.triggers.update_one(
            {"_id": ObjectId(trigger_id)},
            {"$set": update_data}
        )
        
        return {
            "success": True,
            "message": "Gatilho atualizado com sucesso"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao atualizar gatilho: {str(e)}")

@trigger_router.delete("/triggers/{trigger_id}")
async def delete_trigger(trigger_id: str):
    """Exclui um gatilho"""
    try:
        db = await get_database()
        
        result = await db.triggers.delete_one({"_id": ObjectId(trigger_id)})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Gatilho não encontrado")
        
        return {
            "success": True,
            "message": "Gatilho excluído com sucesso"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao excluir gatilho: {str(e)}")

# ==================== ENDPOINTS: ANÁLISE CRUZADA ====================

@trigger_router.post("/cross-analysis")
async def cross_analysis(request: TriggerCrossAnalysisRequest):
    """
    Realiza análise cruzada entre múltiplos gatilhos.
    
    Retorna o desempenho diário de cada gatilho e identifica padrões de reversão.
    """
    try:
        db = await get_database()
        
        print(f"\n🔍 Iniciando análise cruzada...")
        print(f"   Gatilhos: {len(request.trigger_ids)}")
        print(f"   Período: {request.start_date} até {request.end_date}")
        
        # 1. Buscar os gatilhos selecionados
        triggers = []
        for trigger_id in request.trigger_ids:
            trigger = await db.triggers.find_one({"_id": ObjectId(trigger_id)})
            if not trigger:
                raise HTTPException(status_code=404, detail=f"Gatilho {trigger_id} não encontrado")
            trigger["_id"] = str(trigger["_id"])
            triggers.append(trigger)
            print(f"   ✅ Gatilho: {trigger['name']}")
        
        # 2. Buscar todas as partidas do período
        cursor = db.partidas.find({
            "date": {
                "$gte": request.start_date,
                "$lte": request.end_date
            }
        }).sort([("date", 1), ("hour", 1)])
        
        all_matches = await cursor.to_list(length=None)
        print(f"   📊 Total de partidas encontradas: {len(all_matches)}")
        
        if len(all_matches) == 0:
            return {
                "success": True,
                "period": {"start": request.start_date, "end": request.end_date},
                "triggers_analyzed": len(triggers),
                "daily_performance": [],
                "reversal_patterns": [],
                "overall_statistics": {},
                "insights": ["⚠️ Nenhuma partida encontrada no período selecionado"]
            }
        
        # 3. Agrupar partidas por data
        matches_by_date = {}
        for match in all_matches:
            date = match.get("date", "")
            if date not in matches_by_date:
                matches_by_date[date] = []
            matches_by_date[date].append(match)
        
        print(f"   📅 Dias com partidas: {len(matches_by_date)}")
        
        # 4. Calcular desempenho de cada gatilho por dia
        daily_performance = []
        
        for date in sorted(matches_by_date.keys()):
            day_matches = matches_by_date[date]
            
            for trigger in triggers:
                try:
                    perf = calculate_trigger_performance(day_matches, trigger)
                    
                    daily_performance.append({
                        "date": date,
                        "trigger_id": trigger["_id"],
                        "trigger_name": trigger["name"],
                        "greens": perf["greens"],
                        "reds": perf["reds"],
                        "total_operations": perf["total_operations"],
                        "success_rate": perf["success_rate"],
                        "gale_breakdown": perf["gale_breakdown"]
                    })
                except Exception as e:
                    print(f"   ⚠️ Erro ao calcular performance do gatilho {trigger['name']} no dia {date}: {e}")
        
        print(f"   ✅ Registros de performance calculados: {len(daily_performance)}")
        
        # 5. Detectar padrões de reversão (se solicitado)
        reversal_patterns = []
        
        if request.include_reversal_analysis and len(triggers) >= 2:
            # Agrupar por data para análise de reversão
            perf_by_date = {}
            for perf in daily_performance:
                date = perf["date"]
                if date not in perf_by_date:
                    perf_by_date[date] = []
                perf_by_date[date].append(perf)
            
            # Analisar dias consecutivos
            dates = sorted(perf_by_date.keys())
            for i in range(len(dates) - 1):
                today = dates[i]
                tomorrow = dates[i + 1]
                
                today_perfs = perf_by_date[today]
                tomorrow_perfs = perf_by_date[tomorrow]
                
                # Filtrar apenas performances com operações
                today_perfs_with_ops = [p for p in today_perfs if p["total_operations"] > 0]
                tomorrow_perfs_with_ops = [p for p in tomorrow_perfs if p["total_operations"] > 0]
                
                if not today_perfs_with_ops or not tomorrow_perfs_with_ops:
                    continue
                
                # Encontrar gatilho com pior performance hoje
                worst_today = min(today_perfs_with_ops, key=lambda x: x["success_rate"])
                
                # Encontrar gatilho com melhor performance amanhã
                best_tomorrow = max(tomorrow_perfs_with_ops, key=lambda x: x["success_rate"])
                
                # Verificar se há reversão significativa (>30% de diferença)
                if (worst_today["success_rate"] < 40 and 
                    best_tomorrow["success_rate"] > 70 and
                    worst_today["trigger_id"] != best_tomorrow["trigger_id"]):
                    
                    reversal_strength = best_tomorrow["success_rate"] - worst_today["success_rate"]
                    
                    reversal_patterns.append({
                        "date": today,
                        "trigger_poor": worst_today["trigger_name"],
                        "trigger_poor_id": worst_today["trigger_id"],
                        "trigger_good": best_tomorrow["trigger_name"],
                        "trigger_good_id": best_tomorrow["trigger_id"],
                        "poor_success_rate": worst_today["success_rate"],
                        "good_success_rate": best_tomorrow["success_rate"],
                        "reversal_strength": round(reversal_strength, 2),
                        "next_date": tomorrow
                    })
            
            print(f"   🔄 Padrões de reversão encontrados: {len(reversal_patterns)}")
        
        # 6. Calcular estatísticas gerais
        overall_stats = {}
        for trigger in triggers:
            trigger_perfs = [p for p in daily_performance if p["trigger_id"] == trigger["_id"]]
            
            if trigger_perfs:
                total_greens = sum(p["greens"] for p in trigger_perfs)
                total_reds = sum(p["reds"] for p in trigger_perfs)
                total_ops = total_greens + total_reds
                
                # Filtrar apenas performances com operações
                perfs_with_ops = [p for p in trigger_perfs if p["total_operations"] > 0]
                
                # Calcular média apenas se houver dados
                if perfs_with_ops:
                    avg_success_rate = statistics.mean([p["success_rate"] for p in perfs_with_ops])
                else:
                    avg_success_rate = 0
                
                overall_stats[trigger["_id"]] = {
                    "trigger_name": trigger["name"],
                    "total_greens": total_greens,
                    "total_reds": total_reds,
                    "total_operations": total_ops,
                    "overall_success_rate": round((total_greens / total_ops * 100) if total_ops > 0 else 0, 2),
                    "avg_daily_success_rate": round(avg_success_rate, 2),
                    "days_analyzed": len(trigger_perfs),
                    "best_day": max(perfs_with_ops, key=lambda x: x["success_rate"]) if perfs_with_ops else None,
                    "worst_day": min(perfs_with_ops, key=lambda x: x["success_rate"]) if perfs_with_ops else None
                }
        
        # 7. Gerar insights
        insights = []
        
        if len(daily_performance) == 0:
            insights.append("⚠️ Nenhum dos gatilhos selecionados teve operações no período")
        
        if reversal_patterns:
            insights.append(f"🔄 Detectados {len(reversal_patterns)} padrões de reversão entre gatilhos")
            
            # Encontrar o par de gatilhos com mais reversões
            reversal_pairs = {}
            for rev in reversal_patterns:
                pair = f"{rev['trigger_poor']} → {rev['trigger_good']}"
                reversal_pairs[pair] = reversal_pairs.get(pair, 0) + 1
            
            if reversal_pairs:
                most_common = max(reversal_pairs.items(), key=lambda x: x[1])
                insights.append(f"📊 Par mais comum: {most_common[0]} ({most_common[1]}x)")
        
        # Identificar gatilho mais consistente
        if overall_stats:
            best_trigger = max(overall_stats.values(), key=lambda x: x["overall_success_rate"])
            insights.append(f"⭐ Gatilho mais consistente: {best_trigger['trigger_name']} ({best_trigger['overall_success_rate']}%)")
            
            # Volatilidade apenas se houver best_day e worst_day
            triggers_with_volatility = [
                t for t in overall_stats.values() 
                if t["best_day"] and t["worst_day"]
            ]
            
            if triggers_with_volatility:
                most_volatile = max(
                    triggers_with_volatility,
                    key=lambda x: abs(x["best_day"]["success_rate"] - x["worst_day"]["success_rate"])
                )
                insights.append(f"📉 Gatilho mais volátil: {most_volatile['trigger_name']}")
        
        print(f"   ✅ Análise concluída com sucesso!")
        
        return {
            "success": True,
            "period": {"start": request.start_date, "end": request.end_date},
            "triggers_analyzed": len(triggers),
            "daily_performance": daily_performance,
            "reversal_patterns": reversal_patterns,
            "overall_statistics": overall_stats,
            "insights": insights
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"   ❌ Erro na análise cruzada: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Erro na análise cruzada: {str(e)}")