"""
ai_insights_analyzer.py - Sistema de Análise de Insights da IA

Extrai conhecimento aprendido pela IA para uso prático:
- Quais features são mais importantes
- Quais combinações de odds levam a greens
- Quando a IA pula vs quando entra
- Padrões de decisão explicáveis
"""

import numpy as np
import torch
from typing import Dict, List, Tuple
import json
from collections import defaultdict
from datetime import datetime

class AIInsightsAnalyzer:
    """Analisa e extrai insights do modelo treinado"""
    
    def __init__(self, agent, matches_data: List[Dict]):
        """
        Args:
            agent: BettingAgent treinado
            matches_data: Dados de partidas para análise
        """
        self.agent = agent
        self.matches_data = matches_data
        self.insights = {}
        
    def analyze_all(self) -> Dict:
        """Executa todas as análises e retorna insights completos"""
        
        print("🔍 Analisando conhecimento da IA...")
        
        self.insights = {
            "feature_importance": self.get_feature_importance(),
            "best_entry_conditions": self.find_best_entry_conditions(),
            "when_to_skip": self.analyze_skip_decisions(),
            "odds_patterns": self.analyze_odds_patterns(),
            "temporal_insights": self.analyze_temporal_patterns(),
            "win_rate_by_confidence": self.analyze_confidence_levels(),
            "extracted_rules": self.extract_simple_rules(),
        }
        
        return self.insights
    
    def get_feature_importance(self) -> Dict:
        """
        Identifica features mais importantes.
        
        Returns:
            Dict com importância de cada feature
        """
        importance = self.agent.feature_extractor.get_feature_importance(
            self.agent.q_network,
            self.agent.device
        )
        
        # Top 10
        top_features = dict(list(importance.items())[:10])
        
        return {
            "all_features": importance,
            "top_10": top_features,
            "interpretation": self._interpret_features(top_features)
        }
    
    def _interpret_features(self, features: Dict) -> List[str]:
        """Interpreta o significado das features importantes"""
        
        interpretations = []
        
        feature_meanings = {
            "odd_over35": "A odd do over 3.5 é crítica",
            "prob_over35": "A probabilidade implícita de over importa muito",
            "ratio_over_under": "A relação entre odds over/under é decisiva",
            "odd_over25": "Over 2.5 ajuda a prever over 3.5",
            "prob_4plus_gols": "Probabilidade de 4+ gols é relevante",
            "hour": "O horário influencia nas decisões",
            "is_primetime": "Jogos em horário nobre têm padrão diferente",
            "odd_btts": "Ambas marcam está relacionado a over 3.5",
            "ratio_casa_visitante": "Equilíbrio entre times afeta total de gols",
            "recent_winrate": "Histórico recente da IA importa (gestão)",
            "overs_previous_hour": "🔥 Overs na hora anterior são muito relevantes!",
            "has_block_previous_hour": "🔥 Blocos temporais influenciam decisão!",
            "momentum_score": "🔥 Momentum do mercado é importante!",
            "in_hot_block": "🔥 Estar em bloco quente aumenta probabilidade!",
        }
        
        for feature, importance in features.items():
            if feature in feature_meanings:
                interpretations.append(f"• {feature_meanings[feature]} (peso: {importance*100:.1f}%)")
        
        return interpretations
    
    def find_best_entry_conditions(self) -> Dict:
        """
        Descobre em quais condições a IA entra e tem mais sucesso.
        
        Returns:
            Condições ótimas de entrada
        """
        
        results = {
            "greens": [],
            "reds": []
        }
        
        # Simular decisões em todas as partidas
        for match in self.matches_data:
            features = self.agent.feature_extractor.extract(match)
            
            # Obter Q-values
            with torch.no_grad():
                state = torch.FloatTensor(features).unsqueeze(0).to(self.agent.device)
                q_values = self.agent.q_network(state).cpu().numpy()[0]
            
            # Melhor ação
            action = np.argmax(q_values)
            confidence = q_values[action]
            
            # Se entra (ação != 0)
            if action > 0:
                result_data = {
                    "odd_over35": match.get("markets", {}).get("TotalGols_MaisDe_35", 0),
                    "odd_over25": match.get("markets", {}).get("TotalGols_MaisDe_25", 0),
                    "ratio_over_under": self._calc_ratio(match),
                    "hour": match.get("hour", 0),
                    "action": action,  # 1=low, 2=med, 3=high
                    "confidence": confidence,
                    "is_over": match.get("totalGolsFT", 0) > 3.5
                }
                
                if result_data["is_over"]:
                    results["greens"].append(result_data)
                else:
                    results["reds"].append(result_data)
        
        # Análise estatística
        return self._analyze_entry_patterns(results)
    
    def _calc_ratio(self, match: Dict) -> float:
        """Calcula ratio over/under"""
        over = match.get("markets", {}).get("TotalGols_MaisDe_35", 0)
        under = match.get("markets", {}).get("TotalGols_MenosDe_35", 0)
        return over / under if under > 0 else 0
    
    def _analyze_entry_patterns(self, results: Dict) -> Dict:
        """Analisa padrões de entrada bem-sucedidos"""
        
        greens = results["greens"]
        reds = results["reds"]
        
        if not greens:
            return {"error": "Nenhum green encontrado"}
        
        # Estatísticas dos greens
        green_odds = [g["odd_over35"] for g in greens]
        green_ratios = [g["ratio_over_under"] for g in greens]
        green_hours = [g["hour"] for g in greens]
        green_actions = [g["action"] for g in greens]
        
        # Faixas ótimas
        return {
            "total_entries": len(greens) + len(reds),
            "greens": len(greens),
            "reds": len(reds),
            "win_rate": len(greens) / (len(greens) + len(reds)) * 100,
            
            "optimal_conditions": {
                "odd_over35_range": {
                    "min": np.percentile(green_odds, 25),
                    "max": np.percentile(green_odds, 75),
                    "ideal": np.median(green_odds)
                },
                "ratio_over_under_range": {
                    "min": np.percentile(green_ratios, 25),
                    "max": np.percentile(green_ratios, 75),
                    "ideal": np.median(green_ratios)
                },
                "best_hours": self._get_best_hours(green_hours),
                "preferred_action": max(set(green_actions), key=green_actions.count)  # 1, 2 ou 3
            },
            
            "rules_summary": self._generate_rules(greens)
        }
    
    def _get_best_hours(self, hours: List[int]) -> List[int]:
        """Identifica horários com mais greens"""
        from collections import Counter
        hour_counts = Counter(hours)
        return sorted(hour_counts.keys(), key=lambda h: hour_counts[h], reverse=True)[:5]
    
    def _generate_rules(self, greens: List[Dict]) -> List[str]:
        """Gera regras simples baseadas nos greens"""
        
        rules = []
        
        # Análise de odds
        odds = [g["odd_over35"] for g in greens]
        median_odd = np.median(odds)
        
        if median_odd < 3.0:
            rules.append(f"✅ Prefere entrar quando odd over 3.5 < 3.0 (mediana: {median_odd:.2f})")
        elif median_odd < 4.5:
            rules.append(f"✅ Entra em odds médias 3.0-4.5 (mediana: {median_odd:.2f})")
        else:
            rules.append(f"⚠️ Prefere odds altas > 4.5 (mediana: {median_odd:.2f})")
        
        # Análise de ratio
        ratios = [g["ratio_over_under"] for g in greens]
        median_ratio = np.median(ratios)
        
        if median_ratio > 2.5:
            rules.append(f"✅ Over muito mais provável que under (ratio: {median_ratio:.2f})")
        elif median_ratio > 1.5:
            rules.append(f"✅ Over mais provável (ratio: {median_ratio:.2f})")
        else:
            rules.append(f"⚠️ Over e under equilibrados (ratio: {median_ratio:.2f})")
        
        # Análise de horários
        hours = [g["hour"] for g in greens]
        most_common_hour = max(set(hours), key=hours.count)
        rules.append(f"🕐 Horário com mais greens: {most_common_hour}h")
        
        # Análise de ação
        actions = [g["action"] for g in greens]
        action_names = {1: "BAIXO", 2: "MÉDIO", 3: "ALTO"}
        most_common_action = max(set(actions), key=actions.count)
        rules.append(f"💰 Stake preferido: {action_names[most_common_action]}")
        
        return rules
    
    def analyze_skip_decisions(self) -> Dict:
        """Analisa quando a IA decide pular"""
        
        skip_conditions = []
        
        for match in self.matches_data:
            features = self.agent.feature_extractor.extract(match)
            
            with torch.no_grad():
                state = torch.FloatTensor(features).unsqueeze(0).to(self.agent.device)
                q_values = self.agent.q_network(state).cpu().numpy()[0]
            
            action = np.argmax(q_values)
            
            # Se pula (ação 0)
            if action == 0:
                skip_conditions.append({
                    "odd_over35": match.get("markets", {}).get("TotalGols_MaisDe_35", 0),
                    "ratio": self._calc_ratio(match),
                    "was_over": match.get("totalGolsFT", 0) > 3.5
                })
        
        if not skip_conditions:
            return {"message": "IA não pula nenhum jogo (muito agressiva)"}
        
        # Análise
        skipped_overs = sum(1 for s in skip_conditions if s["was_over"])
        skipped_unders = len(skip_conditions) - skipped_overs
        
        odds_when_skip = [s["odd_over35"] for s in skip_conditions]
        
        return {
            "total_skips": len(skip_conditions),
            "skipped_overs": skipped_overs,  # Falsos negativos
            "skipped_unders": skipped_unders,  # Verdadeiros negativos
            "skip_accuracy": skipped_unders / len(skip_conditions) * 100,
            
            "skip_conditions": {
                "typical_odd": np.median(odds_when_skip),
                "odd_range": [np.min(odds_when_skip), np.max(odds_when_skip)]
            },
            
            "interpretation": [
                f"✅ Pula corretamente {skipped_unders}/{len(skip_conditions)} vezes ({skipped_unders/len(skip_conditions)*100:.1f}%)",
                f"⚠️ Perdeu {skipped_overs} overs pulando",
                f"💡 Tipicamente pula quando odd > {np.median(odds_when_skip):.2f}"
            ]
        }
    
    def analyze_odds_patterns(self) -> Dict:
        """Analisa padrões de odds que levam a over 3.5"""
        
        over_matches = [m for m in self.matches_data if m.get("totalGolsFT", 0) > 3.5]
        under_matches = [m for m in self.matches_data if m.get("totalGolsFT", 0) <= 3.5]
        
        over_odds = [m.get("markets", {}).get("TotalGols_MaisDe_35", 0) for m in over_matches]
        under_odds = [m.get("markets", {}).get("TotalGols_MaisDe_35", 0) for m in under_matches]
        
        return {
            "over_matches_stats": {
                "count": len(over_matches),
                "avg_odd": np.mean(over_odds),
                "median_odd": np.median(over_odds),
                "min_odd": np.min(over_odds),
                "max_odd": np.max(over_odds)
            },
            "under_matches_stats": {
                "count": len(under_matches),
                "avg_odd": np.mean(under_odds),
                "median_odd": np.median(under_odds)
            },
            "sweet_spot": {
                "description": "Faixa de odds com maior taxa de over 3.5",
                "range": self._find_sweet_spot(over_matches, under_matches)
            }
        }
    
    def _find_sweet_spot(self, over_matches: List, under_matches: List) -> Dict:
        """Encontra faixa de odds com melhor win rate"""
        
        ranges = [
            (1.0, 2.0, "Muito baixa"),
            (2.0, 3.0, "Baixa"),
            (3.0, 4.0, "Média"),
            (4.0, 5.0, "Alta"),
            (5.0, 10.0, "Muito alta")
        ]
        
        results = []
        
        for min_odd, max_odd, label in ranges:
            overs_in_range = sum(
                1 for m in over_matches 
                if min_odd <= m.get("markets", {}).get("TotalGols_MaisDe_35", 0) < max_odd
            )
            unders_in_range = sum(
                1 for m in under_matches 
                if min_odd <= m.get("markets", {}).get("TotalGols_MaisDe_35", 0) < max_odd
            )
            
            total = overs_in_range + unders_in_range
            if total > 0:
                win_rate = overs_in_range / total * 100
                results.append({
                    "range": f"{min_odd:.1f} - {max_odd:.1f}",
                    "label": label,
                    "win_rate": win_rate,
                    "total_matches": total
                })
        
        # Melhor faixa
        best = max(results, key=lambda x: x["win_rate"])
        
        return {
            "all_ranges": results,
            "best_range": best,
            "recommendation": f"✅ Melhor faixa: {best['range']} ({best['label']}) com {best['win_rate']:.1f}% win rate"
        }
    
    def analyze_temporal_patterns(self) -> Dict:
        """Analisa padrões temporais (horários, dias, etc)"""
        
        hour_stats = defaultdict(lambda: {"overs": 0, "unders": 0})
        
        for match in self.matches_data:
            hour = match.get("hour", 0)
            is_over = match.get("totalGolsFT", 0) > 3.5
            
            if is_over:
                hour_stats[hour]["overs"] += 1
            else:
                hour_stats[hour]["unders"] += 1
        
        # Calcular win rate por hora
        hour_winrates = {}
        for hour, stats in hour_stats.items():
            total = stats["overs"] + stats["unders"]
            if total > 0:
                hour_winrates[hour] = (stats["overs"] / total * 100, total)
        
        # Melhores e piores horários
        sorted_hours = sorted(hour_winrates.items(), key=lambda x: x[1][0], reverse=True)
        
        return {
            "best_hours": [
                {"hour": h, "win_rate": wr, "total": tot}
                for h, (wr, tot) in sorted_hours[:5]
            ],
            "worst_hours": [
                {"hour": h, "win_rate": wr, "total": tot}
                for h, (wr, tot) in sorted_hours[-5:]
            ],
            "recommendation": f"✅ Melhores horários: {', '.join(str(h) for h, _ in sorted_hours[:3])}h"
        }
    
    def analyze_confidence_levels(self) -> Dict:
        """Analisa win rate por nível de confiança da IA"""
        
        confidence_buckets = defaultdict(lambda: {"correct": 0, "total": 0})
        
        for match in self.matches_data:
            features = self.agent.feature_extractor.extract(match)
            
            with torch.no_grad():
                state = torch.FloatTensor(features).unsqueeze(0).to(self.agent.device)
                q_values = self.agent.q_network(state).cpu().numpy()[0]
            
            action = np.argmax(q_values)
            confidence = q_values[action]
            
            # Apenas entradas (não pulos)
            if action > 0:
                is_over = match.get("totalGolsFT", 0) > 3.5
                
                # Bucket de confiança
                if confidence < 0.5:
                    bucket = "Baixa (< 0.5)"
                elif confidence < 1.0:
                    bucket = "Média (0.5-1.0)"
                elif confidence < 1.5:
                    bucket = "Alta (1.0-1.5)"
                else:
                    bucket = "Muito Alta (> 1.5)"
                
                confidence_buckets[bucket]["total"] += 1
                if is_over:
                    confidence_buckets[bucket]["correct"] += 1
        
        results = []
        for bucket, stats in confidence_buckets.items():
            if stats["total"] > 0:
                results.append({
                    "confidence_level": bucket,
                    "win_rate": stats["correct"] / stats["total"] * 100,
                    "total_entries": stats["total"]
                })
        
        return {
            "by_confidence": sorted(results, key=lambda x: x["win_rate"], reverse=True),
            "interpretation": "Quanto maior a confiança da IA, maior o win rate (esperado)"
        }
    
    def extract_simple_rules(self) -> List[str]:
        """Extrai regras simples e acionáveis do modelo"""
        
        rules = []
        
        # Baseado em feature importance
        importance = self.get_feature_importance()
        top_feature = list(importance["top_10"].keys())[0]
        
        rules.append(f"📊 Feature mais importante: {top_feature}")
        
        # Baseado em melhores condições
        entry = self.find_best_entry_conditions()
        if "optimal_conditions" in entry:
            opt = entry["optimal_conditions"]
            rules.append(f"💰 Odd ideal: {opt['odd_over35_range']['ideal']:.2f}")
            rules.append(f"📈 Ratio ideal: {opt['ratio_over_under_range']['ideal']:.2f}")
            rules.append(f"🕐 Melhores horários: {', '.join(map(str, opt['best_hours'][:3]))}h")
        
        # Regras resumidas
        if "rules_summary" in entry:
            rules.extend(entry["rules_summary"])
        
        return rules
    
    def generate_report(self, save_path: str = None) -> str:
        """Gera relatório completo em texto"""
        
        if not self.insights:
            self.analyze_all()
        
        report = []
        report.append("="*80)
        report.append("🤖 RELATÓRIO DE INSIGHTS DA IA - BETTING OVER 3.5")
        report.append("="*80)
        report.append("")
        
        # Feature Importance
        report.append("📊 FEATURES MAIS IMPORTANTES:")
        report.append("-"*80)
        for interp in self.insights["feature_importance"]["interpretation"]:
            report.append(interp)
        report.append("")
        
        # Melhores Condições
        report.append("✅ MELHORES CONDIÇÕES DE ENTRADA:")
        report.append("-"*80)
        entry = self.insights["best_entry_conditions"]
        report.append(f"Win Rate Geral: {entry['win_rate']:.1f}%")
        report.append(f"Total de Entradas: {entry['total_entries']}")
        report.append(f"Greens: {entry['greens']} | Reds: {entry['reds']}")
        report.append("")
        
        if "optimal_conditions" in entry:
            opt = entry["optimal_conditions"]
            report.append(f"🎯 Odd Over 3.5 Ideal: {opt['odd_over35_range']['ideal']:.2f}")
            report.append(f"   Faixa: {opt['odd_over35_range']['min']:.2f} - {opt['odd_over35_range']['max']:.2f}")
            report.append(f"📈 Ratio Over/Under Ideal: {opt['ratio_over_under_range']['ideal']:.2f}")
            report.append(f"🕐 Top 5 Horários: {', '.join(map(str, opt['best_hours']))}h")
            report.append("")
        
        # Regras Resumidas
        report.append("📋 REGRAS APRENDIDAS:")
        report.append("-"*80)
        for rule in self.insights["extracted_rules"]:
            report.append(rule)
        report.append("")
        
        # Sweet Spot
        report.append("🎯 SWEET SPOT DE ODDS:")
        report.append("-"*80)
        sweet = self.insights["odds_patterns"]["sweet_spot"]
        report.append(sweet["recommendation"])
        report.append("")
        
        # Horários
        report.append("🕐 MELHORES HORÁRIOS:")
        report.append("-"*80)
        for h in self.insights["temporal_insights"]["best_hours"][:5]:
            report.append(f"   {h['hour']}h: {h['win_rate']:.1f}% win rate ({h['total']} jogos)")
        report.append("")
        
        # Skip Analysis
        report.append("⏭️ ANÁLISE DE PULOS:")
        report.append("-"*80)
        skip = self.insights["when_to_skip"]
        if "interpretation" in skip:
            for interp in skip["interpretation"]:
                report.append(interp)
        report.append("")
        
        report.append("="*80)
        report.append(f"Relatório gerado em: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        report.append("="*80)
        
        report_text = "\n".join(report)
        
        if save_path:
            with open(save_path, 'w', encoding='utf-8') as f:
                f.write(report_text)
            print(f"✅ Relatório salvo em: {save_path}")
        
        return report_text


# ==================== EXEMPLO DE USO ====================

if __name__ == "__main__":
    # Exemplo de como usar
    print("""
    # 1. Após treinar a IA:
    from ai_betting_system import BettingAgent, AIConfig
    from ai_insights_analyzer import AIInsightsAnalyzer
    
    # 2. Carregar modelo treinado
    agent = BettingAgent(AIConfig())
    agent.load_model("models/best_model.pth")
    
    # 3. Buscar dados
    matches = []  # Buscar do MongoDB
    
    # 4. Analisar
    analyzer = AIInsightsAnalyzer(agent, matches)
    insights = analyzer.analyze_all()
    
    # 5. Gerar relatório
    report = analyzer.generate_report("insights_report.txt")
    print(report)
    
    # 6. Ver melhor gatilho
    print("🎯 MELHOR GATILHO:")
    print(insights["best_entry_conditions"]["rules_summary"])
    """)