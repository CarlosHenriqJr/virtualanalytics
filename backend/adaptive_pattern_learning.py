"""
adaptive_pattern_learning.py - Sistema de Aprendizado Adaptativo de Padrões

Sistema que aprende padrões dia a dia:
1. Analisa um dia e identifica características que levaram ao mercado-alvo
2. Aplica esses padrões no dia seguinte
3. Mede a eficiência (taxa de acerto)
4. Adapta: se funcionar, mantém; se não, aprende novos padrões
5. Identifica o que observar nos jogos anteriores para prever o resultado

Exemplo de uso:
- Mercado-alvo: Over 3.5 (TotalGols_MaisDe_35)
- Dia 1 (01/01/2025): Aprende padrões
- Dia 2 (02/01/2025): Testa padrões aprendidos
- Dia 3 (03/01/2025): Adapta baseado na eficiência
"""

from fastapi import APIRouter, HTTPException
from typing import List, Optional, Dict, Any, Tuple
from datetime import datetime, timedelta
from pydantic import BaseModel
from database import get_database
from collections import defaultdict, Counter
import statistics

adaptive_learning_router = APIRouter(prefix="/adaptive-learning", tags=["adaptive-learning"])

# ==================== MODELOS ====================

class DailyStudyRequest(BaseModel):
    target_market: str  # Ex: "TotalGols_MaisDe_35"
    start_date: str  # Data inicial (YYYY-MM-DD)
    days_to_analyze: int = 10  # Quantos dias analisar
    lookback_games: int = 10  # Quantos jogos anteriores considerar
    max_entries: int = 1  # Número máximo de entradas (Gale): 1, 2, 3, etc

class PatternFeature(BaseModel):
    """Característica de um padrão identificado"""
    feature_name: str
    feature_value: Any
    importance: float  # 0-100, quanto maior, mais importante
    description: str

class DayPattern(BaseModel):
    """Padrão identificado em um dia específico"""
    date: str
    total_games: int
    target_occurrences: int
    target_success_rate: float  # % de vezes que o mercado-alvo ocorreu
    features: List[PatternFeature]
    top_sequences: List[str]  # Sequências de placares mais comuns antes do target

class DayValidation(BaseModel):
    """Validação de padrões aplicados em um dia"""
    date: str
    patterns_applied: List[str]  # Descrição dos padrões aplicados
    predictions_made: int  # Quantas previsões foram feitas
    correct_predictions: int  # Quantas acertaram
    accuracy: float  # Taxa de acerto (0-100)
    should_keep_pattern: bool  # Se deve manter o padrão
    adjustment_needed: str  # Descrição do ajuste necessário
    # Estatísticas de Gale (múltiplas entradas)
    gale_stats: Optional[Dict[str, Any]] = None  # Estatísticas por número de entrada

class AdaptiveLearningResponse(BaseModel):
    """Resposta completa do estudo adaptativo"""
    target_market: str
    start_date: str
    end_date: str
    total_days_analyzed: int
    learning_evolution: List[DayPattern]  # Padrões aprendidos dia a dia
    validation_results: List[DayValidation]  # Resultados das validações
    final_pattern: DayPattern  # Padrão final consolidado
    recommendations: List[str]
    overall_accuracy: float  # Acurácia geral do sistema
    trigger_guide: Optional[Dict[str, Any]] = None  # Guia prático de como identificar o gatilho

# ==================== FUNÇÕES AUXILIARES ====================

def clean_mongo_doc(doc: dict) -> dict:
    """Remove campos do MongoDB que não são serializáveis (como _id)."""
    if doc is None:
        return {}
    return {k: v for k, v in doc.items() if k != '_id'}

def check_market_occurred(match: dict, market: str) -> bool:
    """
    Verifica se um mercado específico ocorreu (ganhou) no jogo.
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
    
    # Gols Exatos
    if "GolsExatos_" in market:
        try:
            exact_goals = int(market.split("_")[-1])
            return total_gols_ft == exact_goals
        except:
            pass
    
    return False

def extract_features_from_previous_games(games: List[dict]) -> Dict[str, Any]:
    """
    Extrai características (features) dos jogos anteriores.
    Essas features serão usadas para identificar padrões.
    """
    if not games:
        return {}
    
    features = {}
    
    # Feature 1: Média de gols totais nos jogos anteriores
    total_goals = [g.get("totalGolsFT", 0) for g in games]
    features["avg_goals"] = statistics.mean(total_goals) if total_goals else 0
    features["max_goals"] = max(total_goals) if total_goals else 0
    features["min_goals"] = min(total_goals) if total_goals else 0
    
    # Feature 2: Tendência de gols (crescente/decrescente)
    if len(total_goals) >= 3:
        recent_avg = statistics.mean(total_goals[-3:])
        older_avg = statistics.mean(total_goals[:-3]) if len(total_goals) > 3 else recent_avg
        features["goals_trend"] = "crescente" if recent_avg > older_avg else "decrescente"
    else:
        features["goals_trend"] = "estável"
    
    # Feature 3: Frequência de jogos com muitos gols (>3)
    high_scoring = sum(1 for g in total_goals if g > 3)
    features["high_scoring_freq"] = (high_scoring / len(games) * 100) if games else 0
    
    # Feature 4: Padrão de placares HT
    placares_ht = [g.get("placarHT", "0-0") for g in games]
    features["most_common_ht"] = Counter(placares_ht).most_common(1)[0][0] if placares_ht else "0-0"
    
    # Feature 5: Sequência de gols nos últimos 3 jogos
    if len(total_goals) >= 3:
        features["last_3_goals_sequence"] = total_goals[-3:]
    else:
        features["last_3_goals_sequence"] = total_goals
    
    # Feature 6: Média de gols no HT
    gols_ht = []
    for g in games:
        placar_ht = g.get("placarHT", "0-0")
        try:
            casa, fora = placar_ht.split("-")
            gols_ht.append(int(casa) + int(fora))
        except:
            gols_ht.append(0)
    features["avg_goals_ht"] = statistics.mean(gols_ht) if gols_ht else 0
    
    # Feature 7: Horário predominante
    hours = [g.get("hour", "00") for g in games]
    features["most_common_hour"] = Counter(hours).most_common(1)[0][0] if hours else "00"
    
    # Feature 8: Variabilidade dos gols (desvio padrão)
    if len(total_goals) > 1:
        features["goals_std_dev"] = statistics.stdev(total_goals)
    else:
        features["goals_std_dev"] = 0
    
    return features

def calculate_feature_importance(features: Dict[str, Any], target_occurred: bool) -> List[PatternFeature]:
    """
    Calcula a importância de cada feature para prever o mercado-alvo.
    """
    pattern_features = []
    
    # Importância baseada em heurísticas
    
    # Feature: Média de gols
    avg_goals = features.get("avg_goals", 0)
    if target_occurred and avg_goals > 2.5:
        importance = min(100, avg_goals * 30)
        pattern_features.append(PatternFeature(
            feature_name="avg_goals",
            feature_value=round(avg_goals, 2),
            importance=importance,
            description=f"Média de {avg_goals:.2f} gols nos jogos anteriores (alta correlação com over 3.5)"
        ))
    
    # Feature: Frequência de jogos com muitos gols
    high_scoring_freq = features.get("high_scoring_freq", 0)
    if high_scoring_freq > 30:
        pattern_features.append(PatternFeature(
            feature_name="high_scoring_freq",
            feature_value=round(high_scoring_freq, 2),
            importance=high_scoring_freq,
            description=f"{high_scoring_freq:.1f}% dos jogos anteriores tiveram >3 gols"
        ))
    
    # Feature: Tendência de gols
    goals_trend = features.get("goals_trend", "estável")
    if goals_trend == "crescente":
        pattern_features.append(PatternFeature(
            feature_name="goals_trend",
            feature_value=goals_trend,
            importance=70,
            description="Tendência crescente de gols nos jogos recentes"
        ))
    
    # Feature: Média de gols no HT
    avg_goals_ht = features.get("avg_goals_ht", 0)
    if avg_goals_ht > 1.5:
        pattern_features.append(PatternFeature(
            feature_name="avg_goals_ht",
            feature_value=round(avg_goals_ht, 2),
            importance=min(100, avg_goals_ht * 40),
            description=f"Média de {avg_goals_ht:.2f} gols no HT indica jogos movimentados"
        ))
    
    # Feature: Variabilidade
    goals_std_dev = features.get("goals_std_dev", 0)
    if goals_std_dev < 1.0:
        pattern_features.append(PatternFeature(
            feature_name="goals_consistency",
            feature_value=round(goals_std_dev, 2),
            importance=60,
            description=f"Baixa variabilidade ({goals_std_dev:.2f}) indica padrão consistente"
        ))
    
    # Ordenar por importância
    pattern_features.sort(key=lambda x: x.importance, reverse=True)
    
    return pattern_features

def matches_pattern(features: Dict[str, Any], reference_pattern: List[PatternFeature], threshold: float = 0.6) -> Tuple[bool, float]:
    """
    Verifica se as features atuais correspondem ao padrão de referência.
    Retorna (match, similarity_score)
    """
    if not reference_pattern:
        return False, 0.0
    
    matches = 0
    total_checks = 0
    
    for pattern_feature in reference_pattern:
        feature_name = pattern_feature.feature_name
        expected_value = pattern_feature.feature_value
        
        if feature_name in features:
            total_checks += 1
            actual_value = features[feature_name]
            
            # Comparação baseada no tipo
            if isinstance(expected_value, (int, float)):
                # Para valores numéricos, aceitar variação de 20%
                tolerance = abs(expected_value * 0.2)
                if abs(actual_value - expected_value) <= tolerance:
                    matches += 1
            elif isinstance(expected_value, str):
                # Para strings, comparação exata
                if actual_value == expected_value:
                    matches += 1
    
    similarity = (matches / total_checks) if total_checks > 0 else 0.0
    return similarity >= threshold, similarity

# ==================== ENDPOINT PRINCIPAL ====================

@adaptive_learning_router.post("/daily-study", response_model=AdaptiveLearningResponse)
async def adaptive_daily_study(request: DailyStudyRequest):
    """
    Realiza estudo adaptativo dia a dia:
    
    Dia 1: Aprende padrões que levaram ao mercado-alvo
    Dia 2+: Aplica padrões aprendidos, mede eficiência, adapta
    
    Retorna a evolução do aprendizado e recomendações finais.
    """
    try:
        db = await get_database()
        
        # Converter data inicial
        start_date = datetime.strptime(request.start_date, "%Y-%m-%d")
        
        learning_evolution = []
        validation_results = []
        current_pattern = None
        
        # Processar cada dia
        for day_offset in range(request.days_to_analyze):
            current_date = start_date + timedelta(days=day_offset)
            date_str = current_date.strftime("%Y-%m-%d")
            
            # Buscar jogos do dia
            cursor = db.partidas.find({"date": date_str}).sort("hour", 1)
            matches = await cursor.to_list(length=None)
            
            if not matches:
                continue
            
            # DIA 1: APRENDIZADO INICIAL
            if day_offset == 0:
                pattern = await learn_patterns_from_day(
                    matches, request.target_market, request.lookback_games
                )
                learning_evolution.append(pattern)
                current_pattern = pattern
            
            # DIA 2+: VALIDAÇÃO E ADAPTAÇÃO
            else:
                validation = await validate_and_adapt(
                    matches, request.target_market, request.lookback_games, current_pattern, request.max_entries
                )
                validation_results.append(validation)
                
                # Se o padrão não está funcionando bem, aprender novo padrão
                if not validation.should_keep_pattern:
                    new_pattern = await learn_patterns_from_day(
                        matches, request.target_market, request.lookback_games
                    )
                    learning_evolution.append(new_pattern)
                    current_pattern = new_pattern
        
        # Calcular acurácia geral
        if validation_results:
            total_predictions = sum(v.predictions_made for v in validation_results)
            total_correct = sum(v.correct_predictions for v in validation_results)
            overall_accuracy = (total_correct / total_predictions * 100) if total_predictions > 0 else 0
        else:
            overall_accuracy = 0
        
        # Gerar recomendações
        recommendations = generate_recommendations(learning_evolution, validation_results, overall_accuracy)
        
        # Gerar guia de gatilho
        trigger_guide = generate_trigger_guide(current_pattern if current_pattern else learning_evolution[-1] if learning_evolution else None, request.target_market)
        
        end_date = (start_date + timedelta(days=request.days_to_analyze - 1)).strftime("%Y-%m-%d")
        
        return AdaptiveLearningResponse(
            target_market=request.target_market,
            start_date=request.start_date,
            end_date=end_date,
            total_days_analyzed=len(learning_evolution) + len(validation_results),
            learning_evolution=learning_evolution,
            validation_results=validation_results,
            final_pattern=current_pattern if current_pattern else learning_evolution[-1] if learning_evolution else None,
            recommendations=recommendations,
            overall_accuracy=overall_accuracy,
            trigger_guide=trigger_guide
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==================== FUNÇÕES DE APRENDIZADO ====================

async def learn_patterns_from_day(matches: List[dict], target_market: str, lookback_games: int) -> DayPattern:
    """
    Aprende padrões de um dia específico.
    Identifica características dos jogos anteriores que levaram ao mercado-alvo.
    """
    date = matches[0].get("date", "")
    total_games = len(matches)
    target_occurrences = 0
    all_features = []
    all_sequences = []
    
    for i, match in enumerate(matches):
        target_occurred = check_market_occurred(match, target_market)
        
        if target_occurred:
            target_occurrences += 1
            
            # Pegar jogos anteriores
            start_idx = max(0, i - lookback_games)
            previous_games = matches[start_idx:i]
            
            if previous_games:
                # Extrair features
                features = extract_features_from_previous_games(previous_games)
                pattern_features = calculate_feature_importance(features, True)
                all_features.extend(pattern_features)
                
                # Extrair sequência de gols
                goals_seq = [g.get("totalGolsFT", 0) for g in previous_games[-5:]]
                all_sequences.append(str(goals_seq))
    
    # Consolidar features mais importantes
    feature_counter = defaultdict(lambda: {"sum_importance": 0, "count": 0, "values": []})
    for feat in all_features:
        feature_counter[feat.feature_name]["sum_importance"] += feat.importance
        feature_counter[feat.feature_name]["count"] += 1
        feature_counter[feat.feature_name]["values"].append(feat.feature_value)
    
    consolidated_features = []
    for feat_name, data in feature_counter.items():
        avg_importance = data["sum_importance"] / data["count"]
        avg_value = statistics.mean([v for v in data["values"] if isinstance(v, (int, float))]) if any(isinstance(v, (int, float)) for v in data["values"]) else data["values"][0]
        
        consolidated_features.append(PatternFeature(
            feature_name=feat_name,
            feature_value=round(avg_value, 2) if isinstance(avg_value, float) else avg_value,
            importance=round(avg_importance, 2),
            description=f"Média de importância: {avg_importance:.1f}%"
        ))
    
    consolidated_features.sort(key=lambda x: x.importance, reverse=True)
    
    # Top sequências
    top_sequences = [seq for seq, _ in Counter(all_sequences).most_common(5)]
    
    success_rate = (target_occurrences / total_games * 100) if total_games > 0 else 0
    
    return DayPattern(
        date=date,
        total_games=total_games,
        target_occurrences=target_occurrences,
        target_success_rate=round(success_rate, 2),
        features=consolidated_features[:10],  # Top 10 features
        top_sequences=top_sequences
    )

async def validate_and_adapt(matches: List[dict], target_market: str, lookback_games: int, reference_pattern: DayPattern, max_entries: int = 1) -> DayValidation:
    """
    Valida se o padrão aprendido funciona no dia atual.
    Retorna métricas de acurácia e se deve manter ou adaptar o padrão.
    
    Com suporte a Gale (múltiplas entradas):
    - max_entries=1: Sem Gale (entrada única)
    - max_entries=2: Gale 1 (2 tentativas)
    - max_entries=3: Gale 2 (3 tentativas)
    """
    date = matches[0].get("date", "")
    predictions_made = 0
    correct_predictions = 0
    patterns_applied = []
    
    # Estatísticas de Gale
    gale_stats = {
        "total_signals": 0,
        "wins_by_entry": {i: 0 for i in range(1, max_entries + 1)},
        "total_wins": 0,
        "total_losses": 0,
        "win_rate_by_entry": {},
        "overall_win_rate": 0
    }
    
    i = 0
    while i < len(matches):
        # Pegar jogos anteriores
        start_idx = max(0, i - lookback_games)
        previous_games = matches[start_idx:i]
        
        if not previous_games:
            i += 1
            continue
        
        # Extrair features do momento atual
        current_features = extract_features_from_previous_games(previous_games)
        
        # Verificar se corresponde ao padrão aprendido
        matches_ref, similarity = matches_pattern(current_features, reference_pattern.features)
        
        if matches_ref:
            predictions_made += 1
            gale_stats["total_signals"] += 1
            patterns_applied.append(f"Similaridade: {similarity:.2%}")
            
            # Lógica de Gale: tentar até max_entries vezes
            won = False
            entry_number = 0
            
            for entry in range(max_entries):
                current_idx = i + entry
                
                # Verificar se ainda há jogos disponíveis
                if current_idx >= len(matches):
                    break
                
                entry_number = entry + 1
                current_match = matches[current_idx]
                
                # Verificar se o mercado ocorreu nesta entrada
                actual_result = check_market_occurred(current_match, target_market)
                
                if actual_result:
                    # GREEN! Ganhou nesta entrada
                    won = True
                    gale_stats["wins_by_entry"][entry_number] += 1
                    gale_stats["total_wins"] += 1
                    correct_predictions += 1
                    break
            
            if not won:
                # RED - perdeu todas as entradas
                gale_stats["total_losses"] += 1
            
            # Pular os jogos usados no Gale
            i += entry_number
        else:
            i += 1
    
    # Calcular estatísticas finais
    if gale_stats["total_signals"] > 0:
        gale_stats["overall_win_rate"] = (gale_stats["total_wins"] / gale_stats["total_signals"]) * 100
        
        for entry_num in range(1, max_entries + 1):
            wins_at_entry = gale_stats["wins_by_entry"][entry_num]
            gale_stats["win_rate_by_entry"][f"entry_{entry_num}"] = {
                "wins": wins_at_entry,
                "percentage": (wins_at_entry / gale_stats["total_signals"]) * 100 if gale_stats["total_signals"] > 0 else 0
            }
    
    accuracy = (correct_predictions / predictions_made * 100) if predictions_made > 0 else 0
    should_keep = accuracy >= 60  # Manter se acurácia >= 60%
    
    if should_keep:
        adjustment = "Padrão está funcionando bem, manter estratégia atual"
    elif accuracy >= 40:
        adjustment = "Padrão com performance mediana, considerar ajustes finos"
    else:
        adjustment = "Padrão com baixa performance, aprender novos padrões do dia atual"
    
    return DayValidation(
        date=date,
        patterns_applied=patterns_applied[:5],  # Top 5
        predictions_made=predictions_made,
        correct_predictions=correct_predictions,
        accuracy=round(accuracy, 2),
        should_keep_pattern=should_keep,
        adjustment_needed=adjustment,
        gale_stats=gale_stats
    )

def generate_recommendations(learning_evolution: List[DayPattern], validation_results: List[DayValidation], overall_accuracy: float) -> List[str]:
    """
    Gera recomendações baseadas no aprendizado e validações.
    """
    recommendations = []
    
    # Recomendação 1: Acurácia geral
    if overall_accuracy >= 70:
        recommendations.append(f"✅ Excelente acurácia geral ({overall_accuracy:.1f}%). O sistema está aprendendo padrões consistentes.")
    elif overall_accuracy >= 50:
        recommendations.append(f"⚠️ Acurácia moderada ({overall_accuracy:.1f}%). Considere aumentar o lookback_games ou ajustar features.")
    else:
        recommendations.append(f"❌ Baixa acurácia ({overall_accuracy:.1f}%). O mercado pode ser muito volátil ou os padrões não são consistentes.")
    
    # Recomendação 2: Features mais importantes
    if learning_evolution:
        last_pattern = learning_evolution[-1]
        if last_pattern.features:
            top_feature = last_pattern.features[0]
            recommendations.append(f"🔍 Feature mais importante: {top_feature.feature_name} (importância: {top_feature.importance:.1f}%)")
    
    # Recomendação 3: Estabilidade do padrão
    if validation_results:
        adaptations_needed = sum(1 for v in validation_results if not v.should_keep_pattern)
        if adaptations_needed == 0:
            recommendations.append("✅ Padrão estável: não foram necessárias adaptações durante o período")
        else:
            recommendations.append(f"⚠️ Padrão instável: {adaptations_needed} adaptações foram necessárias")
    
    # Recomendação 4: Taxa de sucesso do mercado
    if learning_evolution:
        avg_success_rate = statistics.mean([p.target_success_rate for p in learning_evolution])
        recommendations.append(f"📊 Taxa média de ocorrência do mercado: {avg_success_rate:.1f}%")
    
    # Recomendação 5: Como identificar o gatilho (NOVO)
    if learning_evolution:
        last_pattern = learning_evolution[-1]
        if last_pattern.features:
            recommendations.append("\n🎯 COMO IDENTIFICAR O GATILHO DE ENTRADA:")
            
            # Top 3 features mais importantes
            top_3_features = last_pattern.features[:3]
            for i, feat in enumerate(top_3_features, 1):
                recommendations.append(f"{i}. {feat.feature_name}: {feat.feature_value} (importância: {feat.importance:.1f}%)")
            
            # Sequências mais comuns
            if last_pattern.top_sequences:
                recommendations.append(f"\n📈 Sequências de gols mais comuns antes do mercado: {', '.join(last_pattern.top_sequences[:3])}")
            
            # Exemplo prático de gatilho
            recommendations.append("\n✅ EXEMPLO DE GATILHO:")
            if top_3_features:
                feat1 = top_3_features[0]
                recommendations.append(f"Quando você observar que {feat1.feature_name} está próximo de {feat1.feature_value}, considere a entrada.")
    
    return recommendations

def generate_trigger_guide(pattern: DayPattern, target_market: str) -> Dict[str, Any]:
    """
    Gera um guia prático de como identificar o gatilho de entrada.
    """
    if not pattern or not pattern.features:
        return {
            "available": False,
            "message": "Padrão insuficiente para gerar guia de gatilho"
        }
    
    # Top 5 features mais importantes
    top_features = pattern.features[:5]
    
    # Criar checklist de verificação
    checklist = []
    for feat in top_features:
        checklist.append({
            "feature": feat.feature_name,
            "target_value": feat.feature_value,
            "importance": feat.importance,
            "description": f"Verifique se {feat.feature_name} está próximo de {feat.feature_value}"
        })
    
    # Criar exemplo prático
    example = {
        "scenario": f"Você está observando os jogos e quer entrar em {target_market}",
        "steps": []
    }
    
    example["steps"].append("1. Observe os últimos jogos (conforme lookback_games configurado)")
    
    for i, feat in enumerate(top_features[:3], 2):
        example["steps"].append(f"{i}. Verifique se {feat.feature_name} está em torno de {feat.feature_value}")
    
    example["steps"].append(f"{len(top_features[:3]) + 2}. Se todas as condições acima forem atendidas, considere a entrada")
    
    # Sequências de referência
    reference_sequences = []
    if pattern.top_sequences:
        for seq in pattern.top_sequences[:3]:
            reference_sequences.append({
                "sequence": seq,
                "description": f"Sequência de gols observada: {seq}"
            })
    
    # Critérios de entrada
    entry_criteria = {
        "minimum_confidence": "Médio" if pattern.target_success_rate >= 50 else "Baixo",
        "pattern_strength": "Forte" if top_features[0].importance >= 70 else "Moderado" if top_features[0].importance >= 50 else "Fraco",
        "recommended_action": "Entrada recomendada" if pattern.target_success_rate >= 50 and top_features[0].importance >= 60 else "Entrada com cautela"
    }
    
    return {
        "available": True,
        "target_market": target_market,
        "pattern_date": pattern.date,
        "success_rate": pattern.target_success_rate,
        "top_features": checklist,
        "practical_example": example,
        "reference_sequences": reference_sequences,
        "entry_criteria": entry_criteria,
        "summary": f"Para identificar o gatilho de {target_market}, observe principalmente: {top_features[0].feature_name} (importância: {top_features[0].importance:.1f}%)"
    }

