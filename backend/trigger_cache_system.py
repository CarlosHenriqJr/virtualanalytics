"""
trigger_cache_system.py - Sistema de Cache Otimizado + Debug

Resolve o problema de análise zerada e acelera consultas
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from database import get_database
from bson import ObjectId
import statistics

cache_router = APIRouter(prefix="/trigger-cache", tags=["trigger-cache"])

# ==================== DEBUG ====================

def check_trigger_condition_debug(match: dict, condition: Dict[str, Any]) -> tuple[bool, str]:
    """Verifica condição COM debug detalhado"""
    reasons = []
    
    for key, value in condition.items():
        if key not in match:
            return False, f"❌ Campo '{key}' não existe"
        
        match_value = match[key]
        
        if isinstance(value, dict):
            for operator, op_value in value.items():
                if operator == "$lte" and not (match_value <= op_value):
                    return False, f"❌ {key}={match_value} não é <= {op_value}"
                elif operator == "$gte" and not (match_value >= op_value):
                    return False, f"❌ {key}={match_value} não é >= {op_value}"
                elif operator == "$lt" and not (match_value < op_value):
                    return False, f"❌ {key}={match_value} não é < {op_value}"
                elif operator == "$gt" and not (match_value > op_value):
                    return False, f"❌ {key}={match_value} não é > {op_value}"
                elif operator == "$ne" and not (match_value != op_value):
                    return False, f"❌ {key}={match_value} igual a {op_value}"
            reasons.append(f"✓ {key}")
        else:
            if match_value != value:
                return False, f"❌ {key}={match_value} ≠ {value}"
            reasons.append(f"✓ {key}={value}")
    
    return True, " | ".join(reasons)

def check_market_result(match: dict, market: str) -> tuple[bool, str]:
    """Verifica mercado COM info detalhada"""
    total_gols = match.get("totalGolsFT", 0)
    
    if "MaisDe_35" in market or "Over_3_5" in market:
        ok = total_gols > 3.5
        return ok, f"{'✓' if ok else '✗'} {total_gols} gols (>3.5)"
    elif "MaisDe_25" in market or "Over_2_5" in market:
        ok = total_gols > 2.5
        return ok, f"{'✓' if ok else '✗'} {total_gols} gols (>2.5)"
    elif "AmbasMarcam" in market or "BTTS" in market:
        casa = match.get("placarCasaFT", 0)
        fora = match.get("placarForaFT", 0)
        ok = casa > 0 and fora > 0
        return ok, f"{'✓' if ok else '✗'} {casa}x{fora}"
    
    return False, f"❌ Mercado '{market}' não reconhecido"

def calc_performance_debug(matches: List[dict], trigger: dict):
    """Calcula performance COM debug completo"""
    condition = trigger["trigger_condition"]
    target_market = trigger["target_market"]
    skip = trigger.get("skip_games", 0)
    max_gales = trigger.get("max_attempts", 3)
    
    gales = {f"G{i}": 0 for i in range(max_gales)}
    gales["SG"] = 0
    
    current_skip = 0
    sequence = []
    greens = 0
    reds = 0
    debug = []
    triggered_count = 0
    
    for match in matches:
        info = {
            "date": match.get("date", "?"),
            "time": match.get("hour", "?"),
            "teams": f"{match.get('timeCasa', '?')} x {match.get('timeFora', '?')}",
            "matched": False,
            "reason": ""
        }
        
        if current_skip > 0:
            current_skip -= 1
            info["reason"] = f"⏭️ Skip ({current_skip} restam)"
            debug.append(info)
            continue
        
        matched, reason = check_trigger_condition_debug(match, condition)
        
        if not matched:
            info["reason"] = reason
            # Mostrar dados relevantes
            for k in condition.keys():
                if k in match:
                    info[k] = match[k]
            debug.append(info)
            continue
        
        # BATEU!
        info["matched"] = True
        triggered_count += 1
        info["trigger_reason"] = reason
        
        market_ok, market_info = check_market_result(match, target_market)
        info["market"] = market_info
        
        if market_ok:
            # GREEN
            if sequence:
                gale_level = f"G{len(sequence) - 1}"
                gales[gale_level] += 1
                info["result"] = f"🟢 GREEN no {gale_level}"
            else:
                gales["SG"] += 1
                info["result"] = "🟢 GREEN sem gale"
            
            greens += 1
            sequence = []
            current_skip = skip
        else:
            # RED
            sequence.append(match)
            info["result"] = f"🔴 RED (tent. {len(sequence)}/{max_gales})"
            
            if len(sequence) >= max_gales:
                reds += 1
                info["result"] += " ❌ LOSS"
                sequence = []
                current_skip = 0
        
        debug.append(info)
    
    if sequence:
        reds += 1
    
    total = greens + reds
    rate = (greens / total * 100) if total > 0 else 0
    
    return {
        "greens": greens,
        "reds": reds,
        "total_operations": total,
        "success_rate": round(rate, 2),
        "gale_breakdown": gales,
        "total_matches": len(matches),
        "triggered_count": triggered_count
    }, debug

# ==================== CACHE ====================

async def update_cache_for_date(db, trigger: dict, date: str, matches: List[dict]):
    """Atualiza cache de 1 gatilho para 1 data"""
    stats, _ = calc_performance_debug(matches, trigger)
    
    doc = {
        "trigger_id": str(trigger["_id"]),
        "trigger_name": trigger["name"],
        "date": date,
        **stats,
        "computed_at": datetime.now().isoformat()
    }
    
    await db.trigger_daily_cache.update_one(
        {"trigger_id": doc["trigger_id"], "date": date},
        {"$set": doc},
        upsert=True
    )
    
    return doc

# ==================== ENDPOINTS ====================

@cache_router.post("/update")
async def update_cache(request: dict):
    """Atualiza cache (incremental ou total)"""
    try:
        db = await get_database()
        
        trigger_id = request.get("trigger_id")
        start = request.get("start_date")
        end = request.get("end_date") or datetime.now().strftime("%Y-%m-%d")
        force = request.get("force_recalculate", False)
        
        print(f"\n🔄 Atualizando cache...")
        
        # Buscar gatilhos
        if trigger_id:
            t = await db.triggers.find_one({"_id": ObjectId(trigger_id)})
            if not t:
                raise HTTPException(404, "Gatilho não encontrado")
            triggers = [t]
        else:
            triggers = await db.triggers.find({}).to_list(None)
        
        print(f"   📋 {len(triggers)} gatilhos")
        
        # Definir período
        if not start:
            # Buscar última data no cache
            last = await db.trigger_daily_cache.find_one(
                {},
                sort=[("date", -1)]
            )
            start = last["date"] if last else (datetime.now() - timedelta(30)).strftime("%Y-%m-%d")
            start = (datetime.strptime(start, "%Y-%m-%d") + timedelta(1)).strftime("%Y-%m-%d")
        
        print(f"   📅 {start} até {end}")
        
        # Buscar partidas
        matches = await db.partidas.find({
            "date": {"$gte": start, "$lte": end}
        }).sort([("date", 1), ("hour", 1)]).to_list(None)
        
        if not matches:
            return {
                "success": True,
                "message": "Nenhuma partida no período",
                "triggers_updated": 0
            }
        
        print(f"   📊 {len(matches)} partidas")
        
        # Agrupar por data
        by_date = {}
        for m in matches:
            d = m.get("date")
            if d:
                by_date.setdefault(d, []).append(m)
        
        print(f"   📆 {len(by_date)} dias")
        
        # Atualizar cache
        updates = 0
        for trigger in triggers:
            trigger["_id"] = str(trigger.get("_id", ""))
            print(f"\n   🎯 {trigger['name']}")
            
            for date, day_matches in sorted(by_date.items()):
                if not force:
                    exists = await db.trigger_daily_cache.find_one({
                        "trigger_id": trigger["_id"],
                        "date": date
                    })
                    if exists:
                        continue
                
                doc = await update_cache_for_date(db, trigger, date, day_matches)
                updates += 1
                print(f"      {date}: {doc['triggered_count']} jogos | G:{doc['greens']} R:{doc['reds']}")
        
        print(f"\n   ✅ {updates} registros atualizados")
        
        return {
            "success": True,
            "triggers_updated": len(triggers),
            "dates_processed": len(by_date),
            "cache_records": updates
        }
        
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(500, f"Erro: {str(e)}")

@cache_router.get("/status")
async def cache_status():
    """Status do cache de cada gatilho"""
    try:
        db = await get_database()
        triggers = await db.triggers.find({}).to_list(None)
        
        status = []
        for t in triggers:
            tid = str(t["_id"])
            
            stats = await db.trigger_daily_cache.aggregate([
                {"$match": {"trigger_id": tid}},
                {"$group": {
                    "_id": None,
                    "dates": {"$sum": 1},
                    "first": {"$min": "$date"},
                    "last": {"$max": "$date"}
                }}
            ]).to_list(1)
            
            if stats:
                s = stats[0]
                status.append({
                    "trigger_id": tid,
                    "trigger_name": t["name"],
                    "cached": True,
                    "total_dates": s["dates"],
                    "first_date": s["first"],
                    "last_date": s["last"],
                    "needs_update": s["last"] < datetime.now().strftime("%Y-%m-%d")
                })
            else:
                status.append({
                    "trigger_id": tid,
                    "trigger_name": t["name"],
                    "cached": False,
                    "needs_update": True
                })
        
        return {"success": True, "triggers": status}
        
    except Exception as e:
        raise HTTPException(500, str(e))

@cache_router.post("/cross-analysis-fast")
async def cross_analysis_fast(request: dict):
    """Análise cruzada INSTANTÂNEA usando cache"""
    try:
        db = await get_database()
        
        ids = request.get("trigger_ids", [])
        start = request.get("start_date")
        end = request.get("end_date")
        
        if len(ids) < 2:
            raise HTTPException(400, "Mínimo 2 gatilhos")
        if not start or not end:
            raise HTTPException(400, "Período obrigatório")
        
        print(f"\n⚡ Análise RÁPIDA (cache)")
        print(f"   {len(ids)} gatilhos: {start} a {end}")
        
        # Buscar cache
        daily = []
        for tid in ids:
            cached = await db.trigger_daily_cache.find({
                "trigger_id": tid,
                "date": {"$gte": start, "$lte": end}
            }).sort([("date", 1)]).to_list(None)
            
            for c in cached:
                daily.append({
                    "date": c["date"],
                    "trigger_id": c["trigger_id"],
                    "trigger_name": c["trigger_name"],
                    "greens": c["greens"],
                    "reds": c["reds"],
                    "total_operations": c["total_operations"],
                    "success_rate": c["success_rate"],
                    "gale_breakdown": c["gale_breakdown"]
                })
        
        print(f"   📊 {len(daily)} registros")
        
        if not daily:
            return {
                "success": True,
                "daily_performance": [],
                "overall_statistics": {},
                "insights": ["⚠️ Sem dados em cache", "💡 Clique em 'Atualizar Cache'"]
            }
        
        # Estatísticas
        stats = {}
        for tid in ids:
            perfs = [p for p in daily if p["trigger_id"] == tid]
            if not perfs:
                continue
            
            g = sum(p["greens"] for p in perfs)
            r = sum(p["reds"] for p in perfs)
            total = g + r
            
            with_ops = [p for p in perfs if p["total_operations"] > 0]
            avg = statistics.mean([p["success_rate"] for p in with_ops]) if with_ops else 0
            
            stats[tid] = {
                "trigger_name": perfs[0]["trigger_name"],
                "total_greens": g,
                "total_reds": r,
                "total_operations": total,
                "overall_success_rate": round((g / total * 100) if total else 0, 2),
                "avg_daily_success_rate": round(avg, 2),
                "days_analyzed": len(perfs),
                "best_day": max(with_ops, key=lambda x: x["success_rate"]) if with_ops else None,
                "worst_day": min(with_ops, key=lambda x: x["success_rate"]) if with_ops else None
            }
        
        # Reversões
        by_date = {}
        for p in daily:
            by_date.setdefault(p["date"], []).append(p)
        
        reversals = []
        dates = sorted(by_date.keys())
        
        for i in range(len(dates) - 1):
            today_perfs = [p for p in by_date[dates[i]] if p["total_operations"] > 0]
            tmrw_perfs = [p for p in by_date[dates[i+1]] if p["total_operations"] > 0]
            
            if not today_perfs or not tmrw_perfs:
                continue
            
            worst = min(today_perfs, key=lambda x: x["success_rate"])
            best = max(tmrw_perfs, key=lambda x: x["success_rate"])
            
            if worst["success_rate"] < 40 and best["success_rate"] > 70 and worst["trigger_id"] != best["trigger_id"]:
                reversals.append({
                    "date": dates[i],
                    "next_date": dates[i+1],
                    "trigger_poor": worst["trigger_name"],
                    "trigger_good": best["trigger_name"],
                    "poor_success_rate": worst["success_rate"],
                    "good_success_rate": best["success_rate"],
                    "reversal_strength": round(best["success_rate"] - worst["success_rate"], 2)
                })
        
        # Insights
        insights = []
        if reversals:
            insights.append(f"🔄 {len(reversals)} reversões detectadas")
        if stats:
            best = max(stats.values(), key=lambda x: x["overall_success_rate"])
            insights.append(f"⭐ Melhor: {best['trigger_name']} ({best['overall_success_rate']}%)")
        
        print(f"   ✅ Concluído!")
        
        return {
            "success": True,
            "period": {"start": start, "end": end},
            "triggers_analyzed": len(ids),
            "daily_performance": daily,
            "reversal_patterns": reversals,
            "overall_statistics": stats,
            "insights": insights,
            "source": "cache"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(500, str(e))

@cache_router.post("/debug-trigger")
async def debug_trigger(request: dict):
    """DEBUG: Por que gatilho não bate?"""
    try:
        db = await get_database()
        
        tid = request.get("trigger_id")
        date = request.get("date")
        
        if not tid or not date:
            raise HTTPException(400, "trigger_id e date obrigatórios")
        
        trigger = await db.triggers.find_one({"_id": ObjectId(tid)})
        if not trigger:
            raise HTTPException(404, "Gatilho não encontrado")
        
        trigger["_id"] = str(trigger["_id"])
        
        matches = await db.partidas.find({"date": date}).sort([("hour", 1)]).to_list(None)
        
        if not matches:
            return {
                "success": True,
                "message": "Nenhuma partida nesta data",
                "total_matches": 0
            }
        
        stats, debug = calc_performance_debug(matches, trigger)
        
        matched = [d for d in debug if d["matched"]]
        not_matched = [d for d in debug if not d["matched"]]
        
        return {
            "success": True,
            "trigger": {
                "name": trigger["name"],
                "condition": trigger["trigger_condition"],
                "market": trigger["target_market"]
            },
            "date": date,
            "statistics": stats,
            "total_matches": len(matches),
            "matches_triggered": len(matched),
            "matches_not_triggered": len(not_matched),
            "debug_matched": matched[:30],
            "debug_not_matched": not_matched[:30],
            "sample_fields": list(matches[0].keys()) if matches else []
        }
        
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(500, str(e))