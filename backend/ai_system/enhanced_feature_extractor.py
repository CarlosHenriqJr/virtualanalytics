"""
enhanced_feature_extractor.py - Feature Extractor Melhorado com Blocos Temporais

Extensão do FeatureExtractor original que adiciona:
- Análise de blocos temporais
- Momentum score
- Detecção de hot streaks
- Features sobre hora anterior
"""

import numpy as np
from typing import Dict, List
from datetime import datetime, timedelta
from .temporal_block_analysis import TemporalBlockAnalyzer

class EnhancedFeatureExtractor:
    """
    Feature Extractor melhorado com análise temporal de blocos.
    
    Adiciona 11 novas features relacionadas a padrões temporais:
    1. overs_last_60min - Quantos overs nas últimas 60 min
    2. overs_last_60min_ratio - Proporção de overs (0-1)
    3. minutes_since_last_over - Tempo desde último over
    4. minutes_since_last_under - Tempo desde último under
    5. overs_previous_hour - Overs na hora anterior completa
    6. has_block_previous_hour - Se teve 2+ overs na hora anterior (0/1)
    7. in_hot_block - Se está em bloco quente agora (0/1)
    8. block_strength - Força do bloco quente (0-1)
    9. cooling_period - Se está em período de resfriamento (0/1)
    10. momentum_score - Score combinado de momentum (0-1)
    11. streak_length - Comprimento da sequência atual
    """
    
    def __init__(self):
        self.feature_names = []
        self.feature_stats = {}
        
        # Analisador de blocos temporais
        self.block_analyzer = TemporalBlockAnalyzer(block_window_minutes=60)
        
        # Histórico de resultados (para features de blocos)
        self.match_history = []
    
    def extract(self, match_data: Dict, history: List[Dict] = None) -> np.ndarray:
        """
        Extrai TODAS as features de uma partida, incluindo blocos temporais.
        
        Args:
            match_data: Dados da partida (formato padrão)
            history: Histórico recente da IA (opcional)
        
        Returns:
            Array com ~61 features (50 originais + 11 temporais)
        """
        markets = match_data.get("markets", {})
        
        features = {}
        
        # ========== FEATURES ORIGINAIS (50+) ==========
        # (Mantém as mesmas do sistema original)
        
        # 1. ODDS PRINCIPAIS
        features["odd_over35"] = markets.get("TotalGols_MaisDe_35", 0)
        features["odd_over25"] = markets.get("TotalGols_MaisDe_25", 0)
        features["odd_over45"] = markets.get("TotalGols_MaisDe_35", 0) * 1.5
        features["odd_under35"] = markets.get("TotalGols_MenosDe_35", 0)
        features["odd_btts"] = markets.get("ParaOTimeMarcarSimNao_AmbasMarcam", 0)
        features["odd_casa"] = markets.get("VencedorFT_Casa", 0)
        features["odd_visitante"] = markets.get("VencedorFT_Visitante", 0)
        features["odd_empate"] = markets.get("VencedorFT_Empate", 0)
        
        # 2. RATIOS
        if features["odd_over25"] > 0:
            features["ratio_over35_over25"] = features["odd_over35"] / features["odd_over25"]
        else:
            features["ratio_over35_over25"] = 0
        
        if features["odd_under35"] > 0:
            features["ratio_over_under"] = features["odd_over35"] / features["odd_under35"]
        else:
            features["ratio_over_under"] = 0
        
        if features["odd_visitante"] > 0:
            features["ratio_casa_visitante"] = features["odd_casa"] / features["odd_visitante"]
        else:
            features["ratio_casa_visitante"] = 0
        
        # 3. INTERVALO
        features["intervalo_casa"] = markets.get("IntervaloVencedor_Casa", 0)
        features["intervalo_visitante"] = markets.get("IntervaloVencedor_Visitante", 0)
        features["intervalo_empate"] = markets.get("IntervaloVencedor_Empate", 0)
        features["total_gols_ht"] = markets.get("TOTAL_GOLS_HT", 0)
        
        # 4. PROBABILIDADES IMPLÍCITAS
        if features["odd_over35"] > 0:
            features["prob_over35"] = 1 / features["odd_over35"]
        else:
            features["prob_over35"] = 0
        
        for n in range(6):
            odd_key = f"GolsExatos_{n}" if n < 5 else "GolsExatos_5_Mais"
            odd = markets.get(odd_key, 0)
            features[f"prob_{n}gols"] = (1 / odd) if odd > 0 else 0
        
        features["prob_4plus_gols"] = features["prob_4gols"] + features["prob_5gols"]
        
        # 5. MARGEM DE VITÓRIA
        features["margem_casa_3mais"] = markets.get("MargemVitoriaGols_Casa3Mais", 0)
        features["margem_visitante_3mais"] = markets.get("MargemVitoriaGols_Visitante3Mais", 0)
        
        if features["margem_casa_3mais"] > 0:
            features["inv_margem_casa_3"] = 1 / features["margem_casa_3mais"]
        else:
            features["inv_margem_casa_3"] = 0
        
        if features["margem_visitante_3mais"] > 0:
            features["inv_margem_visitante_3"] = 1 / features["margem_visitante_3mais"]
        else:
            features["inv_margem_visitante_3"] = 0
        
        # 6. TEMPORAL BÁSICO
        features["hour"] = match_data.get("hour", 12)
        features["minute"] = match_data.get("minute", 0)
        features["is_primetime"] = 1.0 if features["hour"] in [19, 20, 21] else 0.0
        features["is_afternoon"] = 1.0 if features["hour"] in [14, 15, 16, 17] else 0.0
        features["is_morning"] = 1.0 if features["hour"] in [8, 9, 10, 11] else 0.0
        
        # 7. RESULTADO CORRETO
        features["resultado_4x0_casa"] = markets.get("ResultadoCorreto_Casa_4x0", 0)
        features["resultado_3x2"] = markets.get("ResultadoCorreto_Casa_3x2", 0)
        
        # 8. HISTÓRICO DA IA (se disponível)
        if history:
            recent_results = [h.get("result", 0) for h in history[-5:]]
            while len(recent_results) < 5:
                recent_results.insert(0, 0)
            
            for i, result in enumerate(recent_results):
                features[f"last_{i+1}_result"] = float(result)
            
            features["recent_winrate"] = sum(recent_results) / 5.0
            
            streak = 0
            for r in reversed(recent_results):
                if r == recent_results[-1]:
                    streak += 1
                else:
                    break
            features["current_streak"] = float(streak)
            
            if history:
                features["bankroll_normalized"] = history[-1].get("bankroll", 1000) / 1000.0
            else:
                features["bankroll_normalized"] = 1.0
        else:
            for i in range(5):
                features[f"last_{i+1}_result"] = 0.0
            features["recent_winrate"] = 0.5
            features["current_streak"] = 0.0
            features["bankroll_normalized"] = 1.0
        
        # ========== FEATURES DE BLOCOS TEMPORAIS (11 NOVAS) ==========
        
        # Obter features de blocos
        block_features = self.block_analyzer.get_block_features(
            match_data.get("date", "2025-01-01"),
            match_data.get("hour", 12),
            match_data.get("minute", 0)
        )
        
        # Adicionar ao dicionário de features
        features["overs_last_60min"] = float(block_features["overs_last_60min"])
        features["overs_last_60min_ratio"] = block_features["overs_last_60min_ratio"]
        features["minutes_since_last_over"] = min(block_features["minutes_since_last_over"] / 60.0, 5.0)  # Norm
        features["minutes_since_last_under"] = min(block_features["minutes_since_last_under"] / 60.0, 5.0)
        features["overs_previous_hour"] = float(block_features["overs_previous_hour"])
        features["has_block_previous_hour"] = float(block_features["has_block_previous_hour"])
        features["in_hot_block"] = float(block_features["in_hot_block"])
        features["block_strength"] = block_features["block_strength"]
        features["cooling_period"] = float(block_features["cooling_period"])
        features["momentum_score"] = block_features["momentum_score"]
        features["streak_length_norm"] = block_features["streak_length"] / 10.0
        
        # ========== CONVERSÃO PARA ARRAY ==========
        
        # Salvar nomes (primeira vez)
        if not self.feature_names:
            self.feature_names = list(features.keys())
        
        # Converter para array na ordem correta
        feature_array = np.array([features.get(name, 0) for name in self.feature_names], dtype=np.float32)
        
        # Normalização
        feature_array = self._normalize(feature_array)
        
        return feature_array
    
    def update_history(self, date: str, hour: int, minute: int, result: bool):
        """
        Atualiza histórico de resultados para análise de blocos.
        
        Args:
            date: Data da partida
            hour: Hora
            minute: Minuto
            result: True se foi over 3.5, False caso contrário
        """
        self.block_analyzer.add_match_result(date, hour, minute, result)
        
        # Também armazena no histórico local
        self.match_history.append({
            "date": date,
            "hour": hour,
            "minute": minute,
            "is_over35": result
        })
    
    def _normalize(self, features: np.ndarray) -> np.ndarray:
        """Normaliza features usando Z-score"""
        
        if len(self.feature_stats) == 0:
            self.feature_stats = {
                "mean": features.copy(),
                "std": np.ones_like(features),
                "count": 1
            }
            return features
        
        alpha = 0.01
        self.feature_stats["mean"] = (1 - alpha) * self.feature_stats["mean"] + alpha * features
        self.feature_stats["std"] = np.maximum(
            (1 - alpha) * self.feature_stats["std"] + alpha * np.abs(features - self.feature_stats["mean"]),
            0.01
        )
        
        normalized = (features - self.feature_stats["mean"]) / self.feature_stats["std"]
        normalized = np.clip(normalized, -3, 3)
        
        return normalized
    
    def get_feature_importance(self, model, device) -> Dict[str, float]:
        """Calcula importância de cada feature"""
        
        if not self.feature_names:
            return {}
        
        import torch
        
        test_input = torch.zeros(1, len(self.feature_names)).to(device)
        test_input.requires_grad = True
        
        output = model(test_input)
        output.max().backward()
        
        importance = torch.abs(test_input.grad).squeeze().cpu().numpy()
        importance = importance / (importance.sum() + 1e-8)
        
        feature_importance = {
            name: float(imp) 
            for name, imp in zip(self.feature_names, importance)
        }
        
        return dict(sorted(feature_importance.items(), key=lambda x: x[1], reverse=True))
    
    def get_block_stats(self) -> Dict:
        """Retorna estatísticas dos blocos detectados"""
        
        if not self.match_history:
            return {"total_matches": 0}
        
        analysis = self.block_analyzer.analyze_block_pattern(self.match_history)
        
        return {
            "total_matches": len(self.match_history),
            "total_blocks": analysis["total_blocks"],
            "avg_block_size": analysis["avg_block_size"],
            "max_block_size": analysis["max_block_size"],
            "blocks_per_day": analysis["blocks_per_day"],
            "example_blocks": analysis.get("example_blocks", [])[:3]  # Top 3
        }

# ==================== EXEMPLO DE USO ====================

if __name__ == "__main__":
    extractor = EnhancedFeatureExtractor()
    
    # Simular histórico
    test_matches = [
        {"date": "2025-01-15", "hour": 12, "minute": 6, "totalGolsFT": 5},
        {"date": "2025-01-15", "hour": 12, "minute": 12, "totalGolsFT": 4},
        {"date": "2025-01-15", "hour": 12, "minute": 25, "totalGolsFT": 2},
    ]
    
    # Atualizar histórico
    for m in test_matches:
        extractor.update_history(
            m["date"], m["hour"], m["minute"],
            m["totalGolsFT"] > 3.5
        )
    
    # Nova partida
    current_match = {
        "date": "2025-01-15",
        "hour": 13,
        "minute": 9,
        "markets": {
            "TotalGols_MaisDe_35": 4.2,
            "TotalGols_MaisDe_25": 2.15,
            "TotalGols_MenosDe_35": 1.25,
            "ParaOTimeMarcarSimNao_AmbasMarcam": 1.93,
            "VencedorFT_Casa": 2.2,
            "VencedorFT_Visitante": 3.2,
            "VencedorFT_Empate": 3.5,
        }
    }
    
    # Extrair features
    features = extractor.extract(current_match)
    
    print(f"\n🧠 Total de features extraídas: {len(features)}")
    print(f"📊 Feature names: {len(extractor.feature_names)}")
    
    # Mostrar features de blocos
    block_feature_indices = [i for i, name in enumerate(extractor.feature_names) if 'over' in name or 'block' in name or 'momentum' in name]
    
    print("\n🔥 Features de Blocos Temporais:")
    for idx in block_feature_indices:
        print(f"  {extractor.feature_names[idx]}: {features[idx]:.3f}")
    
    # Estatísticas de blocos
    stats = extractor.get_block_stats()
    print(f"\n📦 Blocos detectados: {stats.get('total_blocks', 0)}")