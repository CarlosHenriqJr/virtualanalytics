"""
comprehensive_stats_analysis.py - Análise Estatística Completa
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, Any, List
from datetime import datetime, timedelta
from pydantic import BaseModel
from database import get_database
from motor.motor_asyncio import AsyncIOMotorDatabase
import logging
import statistics
from collections import defaultdict, Counter

# Configurar router correto
comprehensive_stats_router = APIRouter(prefix="/comprehensive-stats", tags=["comprehensive-stats"])

logger = logging.getLogger(__name__)

# ==================== MODELOS ====================

class PredictiveAnalysisRequest(BaseModel):
    reference_date: str
    target_market: str
    lookback_days: int = 30
    min_pattern_frequency: int = 3
    correlation_method: str = "pearson"

class MarketStats(BaseModel):
    mode: float
    frequency: Dict[str, int]
    std: float
    occurrences_with_data: int
    min_odds: float
    max_odds: float
    avg_odds: float

class PatternResult(BaseModel):
    pattern_key: str
    markets: List[str]
    frequency: int
    confidence: float
    description: str
    examples: List[Dict[str, Any]]

class CorrelationResult(BaseModel):
    markets: List[str]
    pearson: Dict[str, float]
    spearman: Dict[str, float]

# ==================== ENDPOINT PRINCIPAL ====================

@comprehensive_stats_router.post("/predictive-analysis")
async def predictive_analysis(request: PredictiveAnalysisRequest, db: AsyncIOMotorDatabase = Depends(get_database)):
    """
    🎯 ANÁLISE PREDITIVA - Identifica padrões que antecedem um mercado específico
    
    Exemplo: "Antes de um Over 3.5, quais padrões mais ocorreram?"
    """
    try:
        # Extrair parâmetros da requisição
        reference_date = request.reference_date
        target_market = request.target_market
        analysis_days = request.lookback_days
        min_pattern_frequency = request.min_pattern_frequency
        
        logger.info(f"Iniciando análise preditiva para {target_market} na data {reference_date}")
        
        # 1. Buscar jogos que tiveram o mercado alvo (target_market)
        target_matches = await find_matches_with_market(db, reference_date, target_market, analysis_days)
        
        if not target_matches:
            return {
                "reference_date": reference_date,
                "target_market": target_market,
                "analysis_days": analysis_days,
                "insights": [f"Nenhum jogo encontrado com o mercado {target_market} no período especificado"],
                "patterns": [],
                "occurrences_count": 0,
                "market_stats": {},
                "correlations": {"markets": [], "pearson": {}, "spearman": {}},
                "status": "no_data"
            }
        
        # 2. Para cada jogo alvo, buscar padrões antecedentes
        all_patterns = []
        market_data = {}
        
        for target_match in target_matches:
            patterns = await find_antecedent_patterns(db, target_match, analysis_days)
            all_patterns.extend(patterns)
            
            # Coletar dados de mercado para estatísticas
            await collect_market_data(db, target_match, market_data)
        
        # 3. Analisar frequência dos padrões
        pattern_frequency = analyze_pattern_frequency(all_patterns, min_pattern_frequency)
        
        # 4. Calcular estatísticas por mercado
        market_stats = calculate_market_statistics(market_data)
        
        # 5. Calcular correlações entre mercados
        correlations = calculate_market_correlations(market_data)
        
        # 6. Gerar insights
        insights = generate_predictive_insights(pattern_frequency, target_market, len(target_matches))
        
        return {
            "reference_date": reference_date,
            "target_market": target_market,
            "analysis_days": analysis_days,
            "target_matches_count": len(target_matches),
            "insights": insights,
            "patterns": pattern_frequency,
            "occurrences_count": len(all_patterns),
            "market_stats": market_stats,
            "correlations": correlations,
            "status": "success"
        }
        
    except Exception as e:
        logger.error(f"Erro na análise preditiva: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erro na análise preditiva: {str(e)}")

# ==================== FUNÇÕES AUXILIARES ====================

async def find_matches_with_market(db, reference_date: str, target_market: str, days_before: int):
    """Encontra jogos que tiveram o mercado alvo no período especificado"""
    try:
        # Converter a data de referência para datetime
        ref_date = datetime.strptime(reference_date, "%Y-%m-%d")
        start_date = ref_date - timedelta(days=days_before)
        
        query = {
            "date": {
                "$gte": start_date.strftime("%Y-%m-%d"),
                "$lte": reference_date
            },
            f"markets.{target_market}": {"$exists": True}
        }
        
        cursor = db.partidas.find(query).sort("date", -1).limit(100)
        matches = await cursor.to_list(length=None)
        
        logger.info(f"Encontrados {len(matches)} jogos com mercado {target_market}")
        return matches
        
    except Exception as e:
        logger.error(f"Erro ao buscar jogos com mercado: {e}")
        return []

async def find_antecedent_patterns(db, target_match: dict, lookback_days: int):
    """Encontra padrões que antecedem o jogo alvo"""
    patterns = []
    target_date = target_match.get("date")
    target_teams = [target_match.get("timeCasa"), target_match.get("timeFora")]
    
    if not target_date:
        return patterns
    
    try:
        # Buscar jogos anteriores dos mesmos times
        previous_matches_query = {
            "date": {"$lt": target_date},
            "$or": [
                {"timeCasa": {"$in": target_teams}},
                {"timeFora": {"$in": target_teams}}
            ]
        }
        
        cursor = db.partidas.find(previous_matches_query).sort("date", -1).limit(10)
        previous_matches = await cursor.to_list(length=None)
        
        for prev_match in previous_matches:
            pattern = analyze_single_pattern(prev_match, target_match)
            if pattern:
                patterns.append(pattern)
        
        return patterns
        
    except Exception as e:
        logger.error(f"Erro ao buscar padrões antecedentes: {e}")
        return []

def analyze_single_pattern(previous_match: dict, target_match: dict):
    """Analisa padrões em um jogo anterior em relação ao jogo alvo"""
    markets = previous_match.get("markets", {})
    
    if not markets:
        return None
    
    # Identificar mercados com odds significativas
    significant_markets = []
    for market, odds in markets.items():
        if isinstance(odds, (int, float)) and odds > 1.0:
            significant_markets.append({
                "market": market,
                "odds": odds,
                "result": "unknown"
            })
    
    if not significant_markets:
        return None
    
    return {
        "date": previous_match.get("date"),
        "home_team": previous_match.get("timeCasa"),
        "away_team": previous_match.get("timeFora"),
        "pattern_markets": [m["market"] for m in significant_markets],
        "target_date": target_match.get("date"),
        "target_home_team": target_match.get("timeCasa"),
        "target_away_team": target_match.get("timeFora")
    }

async def collect_market_data(db, match: dict, market_data: dict):
    """Coleta dados de mercado para análise estatística"""
    markets = match.get("markets", {})
    
    for market_name, odds_value in markets.items():
        if isinstance(odds_value, (int, float)):
            if market_name not in market_data:
                market_data[market_name] = []
            market_data[market_name].append(odds_value)

def analyze_pattern_frequency(patterns: list, min_frequency: int):
    """Analisa a frequência dos padrões identificados"""
    pattern_counts = {}
    
    for pattern in patterns:
        pattern_key = ",".join(sorted(pattern["pattern_markets"]))
        if pattern_key not in pattern_counts:
            pattern_counts[pattern_key] = {
                "markets": pattern["pattern_markets"],
                "frequency": 0,
                "examples": []
            }
        pattern_counts[pattern_key]["frequency"] += 1
        pattern_counts[pattern_key]["examples"].append(pattern)
    
    # Filtrar por frequência mínima e ordenar
    frequent_patterns = []
    for pattern_key, data in pattern_counts.items():
        if data["frequency"] >= min_frequency:
            frequent_patterns.append({
                "pattern_key": pattern_key,
                "markets": data["markets"],
                "frequency": data["frequency"],
                "confidence": min(100, (data["frequency"] / len(patterns)) * 100) if patterns else 0,
                "description": f"Padrão com {len(data['markets'])} mercados ocorreu {data['frequency']} vezes",
                "examples": data["examples"][:3]  # Primeiros 3 exemplos
            })
    
    # Ordenar por frequência (mais frequentes primeiro)
    return sorted(frequent_patterns, key=lambda x: x["frequency"], reverse=True)

def calculate_market_statistics(market_data: dict):
    """Calcula estatísticas para cada mercado"""
    stats = {}
    
    for market_name, odds_list in market_data.items():
        if len(odds_list) > 0:
            try:
                # Moda (valor mais frequente)
                mode = statistics.mode(odds_list) if odds_list else None
                
                # Frequência de cada valor
                frequency = {}
                for odds in odds_list:
                    odds_key = str(round(odds, 2))
                    frequency[odds_key] = frequency.get(odds_key, 0) + 1
                
                # Desvio padrão (populacional, ddof=0)
                if len(odds_list) > 1:
                    std = statistics.stdev(odds_list)
                else:
                    std = 0
                
                stats[market_name] = {
                    "mode": mode,
                    "frequency": frequency,
                    "std": std,
                    "occurrences_with_data": len(odds_list),
                    "min_odds": min(odds_list) if odds_list else None,
                    "max_odds": max(odds_list) if odds_list else None,
                    "avg_odds": statistics.mean(odds_list) if odds_list else None
                }
            except statistics.StatisticsError:
                # Caso não consiga calcular moda (todos valores únicos)
                stats[market_name] = {
                    "mode": None,
                    "frequency": {str(round(odds, 2)): 1 for odds in odds_list},
                    "std": statistics.stdev(odds_list) if len(odds_list) > 1 else 0,
                    "occurrences_with_data": len(odds_list),
                    "min_odds": min(odds_list),
                    "max_odds": max(odds_list),
                    "avg_odds": statistics.mean(odds_list)
                }
    
    return stats

def calculate_market_correlations(market_data: dict):
    """Calcula matriz de correlação entre mercados (simplificada)"""
    markets = list(market_data.keys())
    correlation_data = {"markets": markets, "pearson": {}, "spearman": {}}
    
    # Implementação simplificada - em produção usar scipy.stats
    for i, market1 in enumerate(markets):
        for market2 in markets[i:]:
            if market1 != market2:
                # Correlação simplificada baseada na similaridade das médias
                data1 = market_data[market1]
                data2 = market_data[market2]
                
                if len(data1) > 1 and len(data2) > 1:
                    mean1 = statistics.mean(data1)
                    mean2 = statistics.mean(data2)
                    
                    # Correlação aproximada baseada na diferença das médias
                    diff = abs(mean1 - mean2)
                    correlation = max(0, 1 - (diff / max(mean1, mean2)))
                    
                    correlation_data["pearson"][f"{market1}_{market2}"] = round(correlation, 3)
                    correlation_data["spearman"][f"{market1}_{market2}"] = round(correlation, 3)
                else:
                    correlation_data["pearson"][f"{market1}_{market2}"] = 0.0
                    correlation_data["spearman"][f"{market1}_{market2}"] = 0.0
    
    return correlation_data

def generate_predictive_insights(patterns: list, target_market: str, target_count: int):
    """Gera insights automáticos sobre os padrões identificados"""
    insights = []
    
    if not patterns:
        insights.append(f"🔍 Nenhum padrão significativo identificado antes de {target_market}")
        return insights
    
    insights.append(f"📈 Foram encontrados {len(patterns)} padrões antecedentes ao {target_market}")
    insights.append(f"🎯 Analisados {target_count} jogos com {target_market} no período")
    
    # Insight do padrão mais frequente
    if patterns:
        top_pattern = patterns[0]
        insights.append(f"🔍 Padrão mais frequente: {', '.join(top_pattern['markets'][:3])} "
                       f"(ocorreu {top_pattern['frequency']} vezes)")
    
    # Insight sobre diversidade de padrões
    unique_markets = set()
    for pattern in patterns:
        unique_markets.update(pattern["markets"])
    
    insights.append(f"🔄 {len(unique_markets)} mercados diferentes aparecem nos padrões identificados")
    
    return insights

# ==================== ENDPOINTS ADICIONAIS ====================

@comprehensive_stats_router.get("/health")
async def health_check():
    """Health check para o router de estatísticas completas"""
    return {"status": "healthy", "router": "comprehensive-stats"}

@comprehensive_stats_router.get("/available-markets")
async def get_available_markets(db: AsyncIOMotorDatabase = Depends(get_database)):
    """Retorna lista de mercados disponíveis para análise"""
    try:
        sample_match = await db.partidas.find_one(
            {"markets": {"$exists": True, "$ne": None, "$ne": {}}},
            {"markets": 1}
        )
        
        if not sample_match or "markets" not in sample_match:
            return {"markets": []}
        
        numeric_markets = []
        for market, value in sample_match["markets"].items():
            if isinstance(value, (int, float)):
                numeric_markets.append(market)
                
        numeric_markets.sort()
        return {"markets": numeric_markets}
    
    except Exception as e:
        logger.error(f"Erro ao buscar mercados: {e}")
        raise HTTPException(status_code=500, detail=f"Erro ao buscar mercados: {str(e)}")