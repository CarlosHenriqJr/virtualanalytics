"""
temporal_block_analysis.py - Análise de Blocos Temporais de Over 3.5

Identifica e analiza clusters (blocos) de over 3.5 próximos no tempo.

Conceitos:
- Bloco Quente: Múltiplos over 3.5 em curto período
- Momentum: Tendência de continuação
- Cooling Period: Período após bloco quente (pode reverter)
"""

from datetime import datetime, timedelta
from typing import List, Dict, Tuple
import numpy as np
from collections import defaultdict

class TemporalBlockAnalyzer:
    """Analisa blocos temporais de over 3.5"""
    
    def __init__(self, block_window_minutes: int = 60):
        """
        Args:
            block_window_minutes: Janela de tempo para considerar um bloco (padrão: 60 min)
        """
        self.block_window_minutes = block_window_minutes
        self.recent_overs = []  # Lista de (timestamp, resultado)
    
    def parse_datetime(self, date_str: str, hour: int, minute: int) -> datetime:
        """Converte data/hora em datetime"""
        return datetime.strptime(f"{date_str} {hour:02d}:{minute:02d}", "%Y-%m-%d %H:%M")
    
    def add_match_result(self, date: str, hour: int, minute: int, is_over35: bool):
        """Adiciona resultado de uma partida ao histórico"""
        dt = self.parse_datetime(date, hour, minute)
        self.recent_overs.append((dt, is_over35))
        
        # Limpar resultados muito antigos (mais de 24h)
        cutoff = dt - timedelta(hours=24)
        self.recent_overs = [(t, r) for t, r in self.recent_overs if t >= cutoff]
    
    def get_block_features(self, current_date: str, current_hour: int, current_minute: int) -> Dict:
        """
        Calcula features relacionadas a blocos temporais.
        
        Returns:
            Dict com features sobre blocos recentes
        """
        current_dt = self.parse_datetime(current_date, current_hour, current_minute)
        
        features = {
            # Última hora (60 minutos)
            "overs_last_60min": 0,
            "overs_last_60min_ratio": 0.0,
            "minutes_since_last_over": 999,
            "minutes_since_last_under": 999,
            
            # Hora anterior (ex: se é 13h, olha 12h)
            "overs_previous_hour": 0,
            "has_block_previous_hour": 0,  # 2+ overs na hora anterior
            
            # Blocos (clusters)
            "in_hot_block": 0,  # Está em bloco quente? (2+ overs em 30min)
            "block_strength": 0.0,  # Força do bloco (0-1)
            "cooling_period": 0,  # Está em período de resfriamento?
            
            # Momentum
            "momentum_score": 0.0,  # Score de momentum (0-1)
            "streak_length": 0,  # Sequência atual de overs
        }
        
        if not self.recent_overs:
            return features
        
        # ===== 1. ÚLTIMA HORA (60 minutos) =====
        last_60min = current_dt - timedelta(minutes=60)
        recent_60min = [(t, r) for t, r in self.recent_overs if t >= last_60min and t < current_dt]
        
        if recent_60min:
            features["overs_last_60min"] = sum(1 for _, r in recent_60min if r)
            features["overs_last_60min_ratio"] = features["overs_last_60min"] / len(recent_60min)
        
        # ===== 2. HORA ANTERIOR ESPECÍFICA =====
        # Ex: se é 13:09, analisa 12:00-12:59
        previous_hour_start = current_dt.replace(minute=0) - timedelta(hours=1)
        previous_hour_end = previous_hour_start + timedelta(hours=1)
        
        previous_hour_matches = [
            (t, r) for t, r in self.recent_overs 
            if previous_hour_start <= t < previous_hour_end
        ]
        
        if previous_hour_matches:
            features["overs_previous_hour"] = sum(1 for _, r in previous_hour_matches if r)
            features["has_block_previous_hour"] = 1 if features["overs_previous_hour"] >= 2 else 0
        
        # ===== 3. TEMPO DESDE ÚLTIMO OVER/UNDER =====
        overs_only = [(t, r) for t, r in self.recent_overs if r]
        unders_only = [(t, r) for t, r in self.recent_overs if not r]
        
        if overs_only:
            last_over_time = max(t for t, _ in overs_only)
            features["minutes_since_last_over"] = int((current_dt - last_over_time).total_seconds() / 60)
        
        if unders_only:
            last_under_time = max(t for t, _ in unders_only)
            features["minutes_since_last_under"] = int((current_dt - last_under_time).total_seconds() / 60)
        
        # ===== 4. BLOCOS QUENTES (HOT BLOCKS) =====
        # Definição: 2+ overs em 30 minutos = bloco quente
        last_30min = current_dt - timedelta(minutes=30)
        recent_30min = [(t, r) for t, r in self.recent_overs if t >= last_30min and t < current_dt and r]
        
        if len(recent_30min) >= 2:
            features["in_hot_block"] = 1
            # Força do bloco: mais overs = mais forte
            features["block_strength"] = min(len(recent_30min) / 5.0, 1.0)  # Max 5 overs = força 1.0
        
        # ===== 5. COOLING PERIOD =====
        # Se teve bloco quente mas já passou tempo sem over = cooling
        if features["in_hot_block"] == 0 and features["overs_last_60min"] >= 2:
            if features["minutes_since_last_over"] > 20:  # 20 min sem over após bloco
                features["cooling_period"] = 1
        
        # ===== 6. MOMENTUM SCORE =====
        # Combina múltiplos fatores para gerar score de momentum
        momentum_factors = [
            features["overs_last_60min"] / 10.0,  # Normalizar (máx 10 overs)
            features["has_block_previous_hour"],
            features["in_hot_block"],
            features["block_strength"],
            1.0 if features["minutes_since_last_over"] < 15 else 0.0,  # Over recente
        ]
        features["momentum_score"] = np.mean(momentum_factors)
        
        # ===== 7. STREAK (SEQUÊNCIA) =====
        # Últimos N resultados consecutivos de over
        streak = 0
        for t, r in sorted(self.recent_overs, key=lambda x: x[0], reverse=True):
            if r:
                streak += 1
            else:
                break
        features["streak_length"] = min(streak, 10)  # Cap em 10
        
        return features
    
    def analyze_block_pattern(self, matches: List[Dict]) -> Dict:
        """
        Analisa padrão de blocos em um conjunto de partidas.
        
        Args:
            matches: Lista de partidas com date, hour, minute, totalGolsFT
        
        Returns:
            Análise estatística dos blocos
        """
        
        # Resetar histórico
        self.recent_overs = []
        
        # Processar todas as partidas
        blocks = []
        current_block = []
        
        for match in sorted(matches, key=lambda x: (x['date'], x['hour'], x['minute'])):
            dt = self.parse_datetime(match['date'], match['hour'], match['minute'])
            is_over = match.get('totalGolsFT', 0) > 3.5
            
            self.add_match_result(match['date'], match['hour'], match['minute'], is_over)
            
            if is_over:
                # Adicionar ao bloco atual
                if not current_block or (dt - current_block[-1][0]).total_seconds() / 60 <= 60:
                    current_block.append((dt, match))
                else:
                    # Bloco anterior terminou, iniciar novo
                    if len(current_block) >= 2:
                        blocks.append(current_block)
                    current_block = [(dt, match)]
            else:
                # Under interrompe bloco
                if len(current_block) >= 2:
                    blocks.append(current_block)
                current_block = []
        
        # Adicionar último bloco
        if len(current_block) >= 2:
            blocks.append(current_block)
        
        # Estatísticas dos blocos
        if not blocks:
            return {
                "total_blocks": 0,
                "avg_block_size": 0,
                "max_block_size": 0,
                "avg_block_duration_minutes": 0,
                "blocks_per_day": 0,
            }
        
        block_sizes = [len(b) for b in blocks]
        block_durations = [
            (b[-1][0] - b[0][0]).total_seconds() / 60 
            for b in blocks
        ]
        
        # Calcular blocos por dia
        if matches:
            first_date = datetime.strptime(matches[0]['date'], '%Y-%m-%d')
            last_date = datetime.strptime(matches[-1]['date'], '%Y-%m-%d')
            days = max((last_date - first_date).days, 1)
        else:
            days = 1
        
        return {
            "total_blocks": len(blocks),
            "avg_block_size": np.mean(block_sizes),
            "max_block_size": max(block_sizes),
            "avg_block_duration_minutes": np.mean(block_durations),
            "blocks_per_day": len(blocks) / days,
            "block_sizes": block_sizes,
            "example_blocks": [
                {
                    "start_time": b[0][0].strftime("%Y-%m-%d %H:%M"),
                    "end_time": b[-1][0].strftime("%Y-%m-%d %H:%M"),
                    "size": len(b),
                    "duration_min": (b[-1][0] - b[0][0]).total_seconds() / 60,
                    "matches": [
                        {
                            "time": m[0].strftime("%H:%M"),
                            "teams": f"{m[1].get('timeCasa')} x {m[1].get('timeFora')}",
                            "score": f"{m[1].get('placarCasaFT')}-{m[1].get('placarForaFT')}",
                            "total": m[1].get('totalGolsFT')
                        }
                        for m in b
                    ]
                }
                for b in blocks[:5]  # Primeiros 5 blocos como exemplo
            ]
        }

# ==================== INTEGRAÇÃO COM IA ====================

def enhance_features_with_blocks(
    base_features: np.ndarray,
    block_features: Dict,
    feature_names: List[str]
) -> Tuple[np.ndarray, List[str]]:
    """
    Adiciona features de blocos às features base.
    
    Args:
        base_features: Features originais
        block_features: Features de blocos temporais
        feature_names: Nomes das features originais
    
    Returns:
        (features_expandidas, nomes_expandidos)
    """
    
    # Extrair valores das features de blocos
    block_values = [
        block_features["overs_last_60min"],
        block_features["overs_last_60min_ratio"],
        block_features["minutes_since_last_over"] / 60.0,  # Normalizar
        block_features["minutes_since_last_under"] / 60.0,
        block_features["overs_previous_hour"],
        block_features["has_block_previous_hour"],
        block_features["in_hot_block"],
        block_features["block_strength"],
        block_features["cooling_period"],
        block_features["momentum_score"],
        block_features["streak_length"] / 10.0,  # Normalizar
    ]
    
    # Novos nomes
    block_feature_names = [
        "overs_last_60min",
        "overs_last_60min_ratio",
        "minutes_since_last_over_norm",
        "minutes_since_last_under_norm",
        "overs_previous_hour",
        "has_block_previous_hour",
        "in_hot_block",
        "block_strength",
        "cooling_period",
        "momentum_score",
        "streak_length_norm",
    ]
    
    # Concatenar
    enhanced_features = np.concatenate([base_features, np.array(block_values, dtype=np.float32)])
    enhanced_names = feature_names + block_feature_names
    
    return enhanced_features, enhanced_names

# ==================== EXEMPLO DE USO ====================

if __name__ == "__main__":
    # Exemplo
    analyzer = TemporalBlockAnalyzer()
    
    # Simular histórico
    test_matches = [
        {"date": "2025-01-15", "hour": 12, "minute": 6, "totalGolsFT": 5},  # Over
        {"date": "2025-01-15", "hour": 12, "minute": 12, "totalGolsFT": 4}, # Over
        {"date": "2025-01-15", "hour": 12, "minute": 25, "totalGolsFT": 2}, # Under
        {"date": "2025-01-15", "hour": 13, "minute": 9, "totalGolsFT": 0},  # Queremos prever esta
    ]
    
    # Adicionar ao histórico
    for m in test_matches[:-1]:
        analyzer.add_match_result(m["date"], m["hour"], m["minute"], m["totalGolsFT"] > 3.5)
    
    # Analisar features para o jogo atual
    current = test_matches[-1]
    features = analyzer.get_block_features(current["date"], current["hour"], current["minute"])
    
    print("\n🔥 Features de Blocos Temporais:")
    print("="*50)
    for key, value in features.items():
        print(f"  {key}: {value}")
    
    print("\n📊 Interpretação:")
    if features["has_block_previous_hour"]:
        print("  ✅ Teve bloco na hora anterior (2+ overs)")
    if features["in_hot_block"]:
        print(f"  🔥 EM BLOCO QUENTE! Força: {features['block_strength']:.2f}")
    if features["momentum_score"] > 0.5:
        print(f"  📈 Momentum alto: {features['momentum_score']:.2f}")
    
    # Análise de blocos
    print("\n📦 Análise de Blocos:")
    print("="*50)
    block_analysis = analyzer.analyze_block_pattern(test_matches)
    print(f"  Total de blocos: {block_analysis['total_blocks']}")
    print(f"  Tamanho médio: {block_analysis['avg_block_size']:.1f}")
    print(f"  Duração média: {block_analysis['avg_block_duration_minutes']:.1f} min")
