"""
correlation_temporal_routes.py - Rotas para Análise de Correlações e Padrões Temporais

Este arquivo implementa os endpoints necessários para as abas:
1. Correlações: Analisa fatores externos (dia da semana, volume, horário, posição, casa/fora)
2. Padrões Temporais: Analisa sequências, blocos, ciclos e volatilidade
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from collections import defaultdict, Counter
from database import get_database
import statistics

correlation_temporal_router = APIRouter(prefix="/over35-analysis", tags=["correlation-temporal"])

# ==================== MODELOS ====================

class CorrelationAnalysisRequest(BaseModel):
    start_date: str
    end_date: str
    target_market: str = "TotalGols_MaisDe_35"

class TemporalPatternsRequest(BaseModel):
    start_date: str
    end_date: str
    target_market: str = "TotalGols_MaisDe_35"

# ==================== FUNÇÕES AUXILIARES ====================

def check_market_success(match: dict, market: str) -> bool:
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

def get_day_of_week(date_str: str) -> str:
    """Retorna o dia da semana em português"""
    days = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"]
    try:
        date = datetime.strptime(date_str, "%Y-%m-%d")
        return days[date.weekday()]
    except:
        return "Desconhecido"

def extract_hour(time_str: str) -> int:
    """Extrai a hora de uma string de tempo"""
    try:
        return int(time_str.split(":")[0])
    except:
        return 0

def get_team_position(match: dict, team: str) -> int:
    """Retorna a posição do time na tabela"""
    # Simplificado - em produção, buscar da tabela de classificação real
    if match.get("team1") == team:
        return match.get("posicaoMandante", 99)
    return match.get("posicaoVisitante", 99)

# ==================== ENDPOINT: ANÁLISE DE CORRELAÇÕES ====================

@correlation_temporal_router.post("/correlation-analysis")
async def analyze_correlations(request: CorrelationAnalysisRequest):
    """
    Analisa correlações entre fatores externos e performance do gatilho.
    
    Fatores analisados:
    - Dia da semana
    - Volume de jogos por dia
    - Horários
    - Casa vs Fora
    - Posição na tabela
    - Força do adversário
    """
    try:
        db = await get_database()
        
        # 1. Buscar todas as partidas do período
        cursor = db.partidas.find({
            "date": {
                "$gte": request.start_date,
                "$lte": request.end_date
            }
        }).sort([("date", 1), ("hour", 1)])
        
        matches = await cursor.to_list(length=None)
        
        if not matches:
            raise HTTPException(status_code=404, detail="Nenhuma partida encontrada no período")
        
        # 2. Analisar cada fator
        
        # Dia da semana
        day_of_week_stats = defaultdict(lambda: {"total": 0, "wins": 0})
        
        # Volume de jogos
        volume_by_date = defaultdict(list)
        
        # Horários
        hourly_stats = defaultdict(lambda: {"total": 0, "wins": 0})
        
        # Casa vs Fora
        home_away_stats = {
            "home": {"total": 0, "wins": 0},
            "away": {"total": 0, "wins": 0}
        }
        
        # Posição
        position_stats = {
            "top5": {"total": 0, "wins": 0},
            "mid": {"total": 0, "wins": 0},
            "bottom": {"total": 0, "wins": 0}
        }
        
        # Processar cada partida
        for match in matches:
            success = check_market_success(match, request.target_market)
            date = match.get("date", "")
            hour = extract_hour(match.get("hour", "00:00"))
            
            # Dia da semana
            day = get_day_of_week(date)
            day_of_week_stats[day]["total"] += 1
            if success:
                day_of_week_stats[day]["wins"] += 1
            
            # Volume
            volume_by_date[date].append(success)
            
            # Horário
            hourly_stats[hour]["total"] += 1
            if success:
                hourly_stats[hour]["wins"] += 1
            
            # Casa vs Fora (analisa ambos os times)
            home_away_stats["home"]["total"] += 1
            home_away_stats["away"]["total"] += 1
            
            home_goals = match.get("placarCasaFT", 0)
            away_goals = match.get("placarForaFT", 0)
            
            # Se casa contribuiu para o mercado
            if request.target_market.startswith("TotalGols"):
                if success:
                    home_away_stats["home"]["wins"] += 1
                    home_away_stats["away"]["wins"] += 1
            
            # Posição
            pos_mandante = match.get("posicaoMandante", 99)
            pos_visitante = match.get("posicaoVisitante", 99)
            
            for pos in [pos_mandante, pos_visitante]:
                if pos <= 5:
                    position_stats["top5"]["total"] += 1
                    if success:
                        position_stats["top5"]["wins"] += 1
                elif pos <= 15:
                    position_stats["mid"]["total"] += 1
                    if success:
                        position_stats["mid"]["wins"] += 1
                else:
                    position_stats["bottom"]["total"] += 1
                    if success:
                        position_stats["bottom"]["wins"] += 1
        
        # 3. Calcular taxas de sucesso
        
        # Dia da semana
        day_results = {}
        for day, stats in day_of_week_stats.items():
            success_rate = (stats["wins"] / stats["total"] * 100) if stats["total"] > 0 else 0
            day_results[day] = {
                "total": stats["total"],
                "wins": stats["wins"],
                "success_rate": round(success_rate, 2)
            }
        
        # Horários
        hourly_results = {}
        for hour, stats in hourly_stats.items():
            success_rate = (stats["wins"] / stats["total"] * 100) if stats["total"] > 0 else 0
            hourly_results[hour] = {
                "total": stats["total"],
                "wins": stats["wins"],
                "success_rate": round(success_rate, 2)
            }
        
        # Casa vs Fora
        home_away_results = {
            "home": {
                "total": home_away_stats["home"]["total"],
                "wins": home_away_stats["home"]["wins"],
                "success_rate": round(
                    (home_away_stats["home"]["wins"] / home_away_stats["home"]["total"] * 100) 
                    if home_away_stats["home"]["total"] > 0 else 0, 2
                )
            },
            "away": {
                "total": home_away_stats["away"]["total"],
                "wins": home_away_stats["away"]["wins"],
                "success_rate": round(
                    (home_away_stats["away"]["wins"] / home_away_stats["away"]["total"] * 100) 
                    if home_away_stats["away"]["total"] > 0 else 0, 2
                )
            }
        }
        
        # Posição
        position_results = {}
        for tier, stats in position_stats.items():
            success_rate = (stats["wins"] / stats["total"] * 100) if stats["total"] > 0 else 0
            position_results[tier] = {
                "total": stats["total"],
                "wins": stats["wins"],
                "success_rate": round(success_rate, 2)
            }
        
        # Volume
        volume_results = {}
        volume_ranges = {"0-5": [], "6-10": [], "11-15": [], "16+": []}
        
        for date, successes in volume_by_date.items():
            total = len(successes)
            wins = sum(successes)
            success_rate = (wins / total * 100) if total > 0 else 0
            
            if total <= 5:
                volume_ranges["0-5"].append(success_rate)
            elif total <= 10:
                volume_ranges["6-10"].append(success_rate)
            elif total <= 15:
                volume_ranges["11-15"].append(success_rate)
            else:
                volume_ranges["16+"].append(success_rate)
        
        for range_key, rates in volume_ranges.items():
            if rates:
                volume_results[range_key] = {
                    "total": len(rates),
                    "success_rate": round(statistics.mean(rates), 2)
                }
        
        # 4. Gerar insights
        best_day = max(day_results.items(), key=lambda x: x[1]["success_rate"])
        worst_day = min(day_results.items(), key=lambda x: x[1]["success_rate"])
        best_hour = max(hourly_results.items(), key=lambda x: x[1]["success_rate"])
        
        overall_success_rate = sum(s["wins"] for s in day_results.values()) / sum(s["total"] for s in day_results.values()) * 100
        
        recommendations = []
        
        if best_day[1]["success_rate"] > overall_success_rate + 10:
            recommendations.append(f"✅ Priorize entradas em {best_day[0]}: {best_day[1]['success_rate']}% de sucesso")
        
        if worst_day[1]["success_rate"] < overall_success_rate - 10:
            recommendations.append(f"⚠️ Evite entradas em {worst_day[0]}: apenas {worst_day[1]['success_rate']}% de sucesso")
        
        if best_hour[1]["success_rate"] > overall_success_rate + 15:
            recommendations.append(f"🕐 Horário ideal: {best_hour[0]}h com {best_hour[1]['success_rate']}% de sucesso")
        
        if abs(home_away_results["home"]["success_rate"] - home_away_results["away"]["success_rate"]) > 10:
            better_location = "casa" if home_away_results["home"]["success_rate"] > home_away_results["away"]["success_rate"] else "fora"
            recommendations.append(f"🏠 Melhor performance jogando {better_location}")
        
        if position_results["top5"]["success_rate"] > position_results["bottom"]["success_rate"] + 15:
            recommendations.append("⭐ Foque em jogos com times bem rankeados (Top 5)")
        
        return {
            "total_games": len(matches),
            "success_rate": round(overall_success_rate, 2),
            "period": {"start": request.start_date, "end": request.end_date},
            "day_of_week": day_results,
            "day_of_week_insight": f"Melhor dia: {best_day[0]} ({best_day[1]['success_rate']}%). Pior dia: {worst_day[0]} ({worst_day[1]['success_rate']}%).",
            "hourly": hourly_results,
            "hourly_insight": f"Horário de pico: {best_hour[0]}h com {best_hour[1]['success_rate']}% de sucesso.",
            "home_away": home_away_results,
            "home_away_insight": f"Diferença casa/fora: {abs(home_away_results['home']['success_rate'] - home_away_results['away']['success_rate']):.1f} pontos percentuais.",
            "position_correlation": position_results,
            "position_insight": f"Times Top 5: {position_results['top5']['success_rate']}%. Times fracos: {position_results['bottom']['success_rate']}%.",
            "volume_correlation": volume_results,
            "volume_insight": "Analise se dias com mais ou menos jogos afetam a performance.",
            "best_factor": {"name": best_day[0], "value": best_day[1]["success_rate"]},
            "worst_factor": {"name": worst_day[0], "value": worst_day[1]["success_rate"]},
            "recommendations": recommendations
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro na análise de correlações: {str(e)}")

# ==================== ENDPOINT: PADRÕES TEMPORAIS ====================

@correlation_temporal_router.post("/temporal-patterns")
async def analyze_temporal_patterns(request: TemporalPatternsRequest):
    """
    Analisa padrões temporais e sequenciais.
    
    Análises:
    - Sequências de greens/reds
    - Blocos de performance (hot/cold)
    - Ciclos e repetições
    - Padrões por horário
    - Volatilidade temporal
    """
    try:
        db = await get_database()
        
        # 1. Buscar todas as partidas do período
        cursor = db.partidas.find({
            "date": {
                "$gte": request.start_date,
                "$lte": request.end_date
            }
        }).sort([("date", 1), ("hour", 1)])
        
        matches = await cursor.to_list(length=None)
        
        if not matches:
            raise HTTPException(status_code=404, detail="Nenhuma partida encontrada no período")
        
        # 2. Analisar sequências
        sequences = []
        current_sequence = {"type": None, "length": 0, "start_idx": 0}
        
        results = []
        for idx, match in enumerate(matches):
            success = check_market_success(match, request.target_market)
            results.append(success)
            
            current_type = "green" if success else "red"
            
            if current_sequence["type"] == current_type:
                current_sequence["length"] += 1
            else:
                if current_sequence["type"]:
                    sequences.append({
                        "type": current_sequence["type"],
                        "length": current_sequence["length"],
                        "start_idx": current_sequence["start_idx"],
                        "end_idx": idx - 1
                    })
                current_sequence = {"type": current_type, "length": 1, "start_idx": idx}
        
        # Adicionar última sequência
        if current_sequence["type"]:
            sequences.append({
                "type": current_sequence["type"],
                "length": current_sequence["length"],
                "start_idx": current_sequence["start_idx"],
                "end_idx": len(matches) - 1
            })
        
        # 3. Analisar padrões por horário
        hourly_patterns = defaultdict(lambda: {
            "total_games": 0,
            "greens": 0,
            "reds": 0,
            "sequences": []
        })
        
        for match in matches:
            hour = extract_hour(match.get("hour", "00:00"))
            success = check_market_success(match, request.target_market)
            
            hourly_patterns[hour]["total_games"] += 1
            if success:
                hourly_patterns[hour]["greens"] += 1
            else:
                hourly_patterns[hour]["reds"] += 1
        
        # Calcular métricas por horário
        hourly_results = []
        for hour in sorted(hourly_patterns.keys()):
            stats = hourly_patterns[hour]
            success_rate = (stats["greens"] / stats["total_games"] * 100) if stats["total_games"] > 0 else 0
            
            hourly_results.append({
                "hour": hour,
                "total_games": stats["total_games"],
                "greens": stats["greens"],
                "reds": stats["reds"],
                "success_rate": round(success_rate, 2),
                "avg_sequence": round(stats["total_games"] / max(len(sequences), 1), 1)
            })
        
        # 4. Detectar blocos (hot/cold)
        window_size = 10  # Janela de análise
        hot_blocks = []
        cold_blocks = []
        
        for i in range(len(results) - window_size + 1):
            window = results[i:i+window_size]
            success_rate = sum(window) / len(window) * 100
            
            if success_rate >= 70:  # Hot block
                hot_blocks.append({
                    "start_time": matches[i].get("hour", ""),
                    "end_time": matches[i+window_size-1].get("hour", ""),
                    "duration": window_size,
                    "wins": sum(window),
                    "total": len(window),
                    "success_rate": round(success_rate, 2)
                })
            elif success_rate <= 30:  # Cold block
                cold_blocks.append({
                    "start_time": matches[i].get("hour", ""),
                    "end_time": matches[i+window_size-1].get("hour", ""),
                    "duration": window_size,
                    "wins": sum(window),
                    "total": len(window),
                    "success_rate": round(success_rate, 2)
                })
        
        # 5. Analisar ciclos
        green_intervals = []
        last_green_idx = -1
        
        for idx, success in enumerate(results):
            if success:
                if last_green_idx >= 0:
                    green_intervals.append(idx - last_green_idx)
                last_green_idx = idx
        
        avg_interval = statistics.mean(green_intervals) if green_intervals else 0
        
        # Detectar padrões comuns
        pattern_counter = Counter()
        pattern_size = 5
        
        for i in range(len(results) - pattern_size + 1):
            pattern = tuple(results[i:i+pattern_size])
            pattern_counter[pattern] += 1
        
        common_patterns = []
        for pattern, count in pattern_counter.most_common(5):
            if count >= 2:  # Apareceu pelo menos 2 vezes
                pattern_str = "".join(["G" if x else "R" for x in pattern])
                
                # Calcular sucesso após o padrão
                success_after = 0
                total_after = 0
                for i in range(len(results) - pattern_size):
                    if tuple(results[i:i+pattern_size]) == pattern and i+pattern_size < len(results):
                        total_after += 1
                        if results[i+pattern_size]:
                            success_after += 1
                
                success_rate_after = (success_after / total_after * 100) if total_after > 0 else 0
                
                common_patterns.append({
                    "sequence": pattern_str,
                    "occurrences": count,
                    "success_after": round(success_rate_after, 2)
                })
        
        most_common_pattern = common_patterns[0]["sequence"] if common_patterns else "N/A"
        
        # 6. Calcular métricas gerais
        total_greens = sum(results)
        total_reds = len(results) - total_greens
        overall_success_rate = (total_greens / len(results) * 100) if results else 0
        
        pattern_strength = overall_success_rate
        consistency_score = 100 - (statistics.stdev([int(x) for x in results]) * 100) if len(results) > 1 else 0
        
        # Volatilidade (desvio padrão das taxas de sucesso por hora)
        hourly_rates = [h["success_rate"] for h in hourly_results if h["total_games"] >= 5]
        volatility_score = statistics.stdev(hourly_rates) if len(hourly_rates) > 1 else 0
        
        # 7. Gerar recomendações
        recommendations = []
        
        green_seq = [s for s in sequences if s["type"] == "green"]
        red_seq = [s for s in sequences if s["type"] == "red"]
        
        if green_seq:
            avg_green_length = statistics.mean([s["length"] for s in green_seq])
            if avg_green_length >= 3:
                recommendations.append(f"📈 Sequências verdes médias de {avg_green_length:.1f} jogos - aproveite as ondas")
        
        if red_seq:
            max_red_length = max([s["length"] for s in red_seq])
            if max_red_length >= 5:
                recommendations.append(f"⚠️ Cuidado: sequências vermelhas podem chegar a {max_red_length} jogos")
        
        if hot_blocks:
            recommendations.append(f"🔥 Detectados {len(hot_blocks)} blocos quentes (70%+ de sucesso)")
        
        if avg_interval > 0:
            recommendations.append(f"⏱️ Em média, um green ocorre a cada {avg_interval:.1f} jogos")
        
        if volatility_score > 20:
            recommendations.append("📊 Alta volatilidade detectada - ajuste o gerenciamento de risco")
        
        # 8. Preparar resposta
        return {
            "total_days": len(set(m.get("date") for m in matches)),
            "total_sequences": len(sequences),
            "pattern_strength": round(pattern_strength, 2),
            "consistency_score": round(max(0, consistency_score), 2),
            "sequences": sequences[:20],  # Limitar para não sobrecarregar
            "hourly_patterns": hourly_results,
            "hourly_insight": f"Horários mais consistentes identificados. Volatilidade: {volatility_score:.1f}%",
            "blocks": {
                "hot_blocks": hot_blocks[:5],
                "cold_blocks": cold_blocks[:5]
            },
            "blocks_insight": f"Detectados {len(hot_blocks)} blocos quentes e {len(cold_blocks)} blocos frios.",
            "cycles": {
                "avg_interval_between_wins": round(avg_interval, 2),
                "most_common_pattern": most_common_pattern,
                "detected_patterns": common_patterns,
                "predictability_score": round(100 - volatility_score, 2) if volatility_score < 100 else 0
            },
            "cycles_insight": f"Intervalo médio entre greens: {avg_interval:.1f} jogos.",
            "volatility": {
                "score": round(volatility_score, 2),
                "high_volatility_periods": [{"time_range": f"{h['hour']}h", "std_deviation": volatility_score} for h in hourly_results if h["success_rate"] > 70 or h["success_rate"] < 30][:3],
                "low_volatility_periods": [{"time_range": f"{h['hour']}h", "std_deviation": volatility_score/2} for h in hourly_results if 45 <= h["success_rate"] <= 55][:3]
            },
            "volatility_insight": f"Volatilidade geral: {volatility_score:.1f}%. {'Alta' if volatility_score > 20 else 'Moderada' if volatility_score > 10 else 'Baixa'}.",
            "sequence_insight": f"Maior sequência verde: {max([s['length'] for s in green_seq]) if green_seq else 0}. Maior sequência vermelha: {max([s['length'] for s in red_seq]) if red_seq else 0}.",
            "recommendations": recommendations
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro na análise de padrões temporais: {str(e)}")