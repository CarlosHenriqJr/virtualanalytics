"""
analyze_feature_importance.py - Analisa importância das features

Usa várias técnicas para identificar features mais importantes:
- Análise de gradientes
- Análise de correlação com resultados
- Análise de variância
- Ranking combinado

Uso:
    python analyze_feature_importance.py models/best_model.pt
"""

import torch
import numpy as np
import asyncio
from typing import Dict, List
import logging
import sys

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class FeatureImportanceAnalyzer:
    """Analisa importância das features do modelo"""
    
    def __init__(self, agent, matches: List[Dict]):
        self.agent = agent
        self.matches = matches
        self.feature_extractor = agent.feature_extractor
        self.feature_names = self.feature_extractor.get_feature_names()
    
    def analyze_all(self) -> Dict:
        """
        Executa todas as análises de importância.
        
        Returns:
            Dict com rankings de diferentes métodos
        """
        
        logger.info("🔍 Analisando importância das features...")
        
        results = {}
        
        # 1. Análise de gradientes
        logger.info("1️⃣ Análise de gradientes...")
        results['gradient_importance'] = self._analyze_gradients()
        
        # 2. Análise de correlação
        logger.info("2️⃣ Análise de correlação com resultados...")
        results['correlation_importance'] = self._analyze_correlation()
        
        # 3. Análise de variância
        logger.info("3️⃣ Análise de variância...")
        results['variance_importance'] = self._analyze_variance()
        
        # 4. Ranking combinado
        logger.info("4️⃣ Calculando ranking combinado...")
        results['combined_ranking'] = self._combine_rankings(results)
        
        logger.info("✅ Análise completa!")
        
        return results
    
    def _analyze_gradients(self) -> Dict:
        """
        Analisa importância usando gradientes da rede.
        
        Features com gradientes altos têm maior impacto.
        """
        
        self.agent.q_network.eval()
        
        # Criar input dummy com gradientes
        dummy_input = torch.zeros(
            1,
            len(self.feature_names),
            requires_grad=True,
            device=self.agent.device
        )
        
        # Forward pass
        output = self.agent.q_network(dummy_input)
        
        # Backward para cada ação
        gradients = []
        for action_idx in range(self.agent.config.output_size):
            self.agent.q_network.zero_grad()
            if dummy_input.grad is not None:
                dummy_input.grad.zero_()
            
            output[0, action_idx].backward(retain_graph=True)
            
            grad = torch.abs(dummy_input.grad).squeeze().cpu().numpy()
            gradients.append(grad)
        
        # Média dos gradientes de todas as ações
        avg_gradients = np.mean(gradients, axis=0)
        
        # Normalizar
        if avg_gradients.sum() > 0:
            avg_gradients = avg_gradients / avg_gradients.sum()
        
        # Criar dict
        importance = {
            name: float(imp)
            for name, imp in zip(self.feature_names, avg_gradients)
        }
        
        # Ordenar
        importance = dict(
            sorted(importance.items(), key=lambda x: x[1], reverse=True)
        )
        
        return importance
    
    def _analyze_correlation(self) -> Dict:
        """
        Analisa correlação das features com resultados (over 3.5).
        
        Features com alta correlação são bons preditores.
        """
        
        # Extrair features de todas as partidas
        all_features = []
        all_results = []
        
        for match in self.matches:
            features = self.feature_extractor.extract(match)
            is_over = match.get("totalGolsFT", 0) > 3.5
            
            all_features.append(features)
            all_results.append(1.0 if is_over else 0.0)
        
        all_features = np.array(all_features)
        all_results = np.array(all_results)
        
        # Calcular correlação de cada feature com resultado
        correlations = []
        for i in range(all_features.shape[1]):
            feature_values = all_features[:, i]
            
            # Correlação de Pearson
            corr = np.corrcoef(feature_values, all_results)[0, 1]
            
            # Usar valor absoluto (tanto positivo quanto negativo importa)
            correlations.append(abs(corr) if not np.isnan(corr) else 0.0)
        
        # Normalizar
        correlations = np.array(correlations)
        if correlations.sum() > 0:
            correlations = correlations / correlations.sum()
        
        # Criar dict
        importance = {
            name: float(corr)
            for name, corr in zip(self.feature_names, correlations)
        }
        
        # Ordenar
        importance = dict(
            sorted(importance.items(), key=lambda x: x[1], reverse=True)
        )
        
        return importance
    
    def _analyze_variance(self) -> Dict:
        """
        Analisa variância das features.
        
        Features com baixa variância (sempre igual) não são úteis.
        """
        
        # Extrair features de todas as partidas
        all_features = []
        
        for match in self.matches:
            features = self.feature_extractor.extract(match)
            all_features.append(features)
        
        all_features = np.array(all_features)
        
        # Calcular variância de cada feature
        variances = np.var(all_features, axis=0)
        
        # Normalizar
        if variances.sum() > 0:
            variances = variances / variances.sum()
        
        # Criar dict
        importance = {
            name: float(var)
            for name, var in zip(self.feature_names, variances)
        }
        
        # Ordenar
        importance = dict(
            sorted(importance.items(), key=lambda x: x[1], reverse=True)
        )
        
        return importance
    
    def _combine_rankings(self, results: Dict) -> Dict:
        """
        Combina rankings de diferentes métodos.
        
        Usa média ponderada dos rankings.
        """
        
        # Pesos para cada método
        weights = {
            'gradient_importance': 0.4,  # Gradientes são muito importantes
            'correlation_importance': 0.4,  # Correlação também
            'variance_importance': 0.2  # Variância menos (mas elimina features inúteis)
        }
        
        # Calcular score combinado
        combined = {}
        
        for feature_name in self.feature_names:
            score = 0.0
            
            for method, weight in weights.items():
                feature_score = results[method].get(feature_name, 0.0)
                score += feature_score * weight
            
            combined[feature_name] = score
        
        # Normalizar
        total = sum(combined.values())
        if total > 0:
            combined = {k: v/total for k, v in combined.items()}
        
        # Ordenar
        combined = dict(
            sorted(combined.items(), key=lambda x: x[1], reverse=True)
        )
        
        return combined
    
    def print_top_features(self, results: Dict, top_n: int = 30):
        """Imprime top N features mais importantes"""
        
        print("\n" + "="*80)
        print(f"🏆 TOP {top_n} FEATURES MAIS IMPORTANTES")
        print("="*80)
        
        for method in ['gradient_importance', 'correlation_importance', 'combined_ranking']:
            print(f"\n📊 {method.replace('_', ' ').upper()}:")
            print("-" * 80)
            
            ranking = results[method]
            
            for i, (feature, score) in enumerate(list(ranking.items())[:top_n], 1):
                # Barra de progresso visual
                bar_length = int(score * 50)
                bar = "█" * bar_length + "░" * (50 - bar_length)
                
                print(f"{i:2d}. {feature:45s} {bar} {score*100:5.2f}%")
        
        print("\n" + "="*80 + "\n")
    
    def print_category_importance(self, results: Dict):
        """Agrupa features por categoria e mostra importância"""
        
        combined = results['combined_ranking']
        
        # Categorias
        categories = {
            'Odds': ['odd_', 'prob_'],
            'Ratios': ['ratio_', 'combo_'],
            'Temporal': ['hour', 'is_', 'dia_', 'periodo_'],
            'Forma Casa': ['casa_'],
            'Forma Visitante': ['visitante_'],
            'H2H': ['h2h_'],
            'Contexto': ['equilibrio', 'favorito', 'azarao', 'score_'],
            'Meta': ['confianca_', 'qualidade_', 'liquidez_', 'consenso_']
        }
        
        category_scores = {}
        
        for category, prefixes in categories.items():
            score = 0.0
            count = 0
            
            for feature_name, feature_score in combined.items():
                for prefix in prefixes:
                    if prefix in feature_name:
                        score += feature_score
                        count += 1
                        break
            
            category_scores[category] = (score, count)
        
        # Ordenar por score
        sorted_categories = sorted(
            category_scores.items(),
            key=lambda x: x[1][0],
            reverse=True
        )
        
        print("\n" + "="*80)
        print("📊 IMPORTÂNCIA POR CATEGORIA")
        print("="*80)
        
        for category, (score, count) in sorted_categories:
            bar_length = int(score * 50)
            bar = "█" * bar_length + "░" * (50 - bar_length)
            
            print(f"{category:20s} ({count:2d} features) {bar} {score*100:5.2f}%")
        
        print("="*80 + "\n")


async def main():
    """Função principal"""
    
    if len(sys.argv) < 2:
        print("\n❌ Uso: python analyze_feature_importance.py <caminho_modelo.pt>\n")
        sys.exit(1)
    
    model_path = sys.argv[1]
    
    print("\n" + "="*80)
    print("🔍 ANÁLISE DE IMPORTÂNCIA DAS FEATURES")
    print("="*80)
    print(f"Modelo: {model_path}")
    print("="*80 + "\n")
    
    # Carregar matches
    logger.info("📊 Carregando partidas do banco...")
    from database import connect_to_mongo, get_db
    
    await connect_to_mongo()
    db = await get_db()
    
    cursor = db.partidas.find().limit(1000)
    matches = await cursor.to_list(length=1000)
    
    logger.info(f"✅ {len(matches)} partidas carregadas")
    
    # Carregar modelo
    logger.info(f"📂 Carregando modelo: {model_path}")
    
    from ai_betting_agent_v2 import QualityBettingAgent, AIConfig
    
    config = AIConfig()
    agent = QualityBettingAgent(config)
    agent.load_model(model_path)
    
    logger.info("✅ Modelo carregado")
    
    # Criar analyzer
    analyzer = FeatureImportanceAnalyzer(agent, matches)
    
    # Analisar
    results = analyzer.analyze_all()
    
    # Imprimir resultados
    analyzer.print_top_features(results, top_n=30)
    analyzer.print_category_importance(results)
    
    # Salvar em arquivo
    import json
    output_path = model_path.replace('.pt', '_feature_importance.json')
    
    with open(output_path, 'w') as f:
        # Converter para formato serializável
        serializable_results = {
            method: dict(list(ranking.items())[:50])  # Top 50
            for method, ranking in results.items()
        }
        json.dump(serializable_results, f, indent=2)
    
    logger.info(f"💾 Resultados salvos em: {output_path}")
    
    print("\n✅ Análise completa!\n")


if __name__ == "__main__":
    asyncio.run(main())
