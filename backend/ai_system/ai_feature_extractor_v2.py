"""
ai_feature_extractor_v2.py - Feature Extractor AVANÇADO para Over 3.5

Features:
- 135 odds disponíveis (todas!)
- Forma recente dos times (últimos 5 jogos)
- Head-to-head histórico
- Padrões temporais avançados
- Combinações inteligentes de odds
- Indicadores de qualidade

Objetivo: Win Rate 60%+ com alta seletividade
"""

import numpy as np
from typing import Dict, List
import logging
from datetime import datetime, timedelta
from collections import defaultdict

logger = logging.getLogger(__name__)


class AdvancedFeatureExtractor:
    """Feature Extractor Avançado para Over 3.5 com foco em QUALIDADE"""
    
    def __init__(self):
        self.feature_names = []
        self._initialize_feature_names()
        
        # Cache para histórico
        self.team_history_cache = defaultdict(list)
        self.h2h_cache = {}
        
        # Estatísticas
        self.stats = {
            'total_extractions': 0,
            'avg_feature_count': 0
        }
    
    def _initialize_feature_names(self):
        """Inicializa nomes das features"""
        
        # 1. ODDS PRINCIPAIS (20 features core)
        core_odds = [
            "odd_over15", "odd_over25", "odd_over35", "odd_over45",
            "odd_under15", "odd_under25", "odd_under35", "odd_under45",
            "odd_btts_yes", "odd_btts_no",
            "odd_casa", "odd_empate", "odd_visitante",
            "odd_dnb_casa", "odd_dnb_visitante",
            "odd_dc_casa_empate", "odd_dc_casa_visitante", "odd_dc_empate_visitante",
            "odd_over_corner_85", "odd_under_corner_85"
        ]
        
        # 2. PROBABILIDADES IMPLÍCITAS (20 features)
        prob_odds = [f"prob_{odd}" for odd in core_odds]
        
        # 3. RATIOS E COMBINAÇÕES (30 features)
        ratios = [
            "ratio_over35_under35",
            "ratio_over25_under25",
            "ratio_over45_under45",
            "ratio_casa_visitante",
            "ratio_over35_casa",
            "ratio_over35_visitante",
            "ratio_btts_yes_no",
            "ratio_over35_btts_yes",
            "ratio_over35_empate",
            "ratio_over25_over35",
            "ratio_over35_over45",
            
            # Combinações AVANÇADAS
            "combo_over35_btts",
            "combo_over25_over35",
            "combo_casa_over25",
            "combo_visitante_over25",
            "combo_empate_under25",
            "valor_esperado_over35",
            "valor_esperado_over25",
            "valor_esperado_btts",
            "edge_over35",
            "edge_over25",
            "desvio_odd_over35",
            "desvio_odd_casa",
            "score_qualidade_odd",
            "score_desequilibrio",
            "score_valor",
            "score_confianca_over35",
            "probabilidade_4plus_gols",
            "probabilidade_5plus_gols",
            "margem_casa"
        ]
        
        # 4. FEATURES TEMPORAIS (15 features)
        temporal = [
            "hour",
            "is_primetime",
            "is_weekend",
            "is_night",
            "dia_semana",
            "hora_normalizada",
            "periodo_dia",
            "is_horario_nobre_apostas",
            "minuto_jogo",
            "fase_jogo",
            "tempo_desde_inicio",
            "is_final_campeonato",
            "densidade_jogos_hora",
            "jogos_simultaneos",
            "intervalo_proximo_jogo"
        ]
        
        # 5. FORMA RECENTE CASA (20 features)
        forma_casa = [
            "casa_gols_marcados_media_5j",
            "casa_gols_sofridos_media_5j",
            "casa_total_gols_media_5j",
            "casa_over25_last5",
            "casa_over35_last5",
            "casa_btts_last5",
            "casa_vitorias_last5",
            "casa_derrotas_last5",
            "casa_empates_last5",
            "casa_pontos_last5",
            "casa_gols_1tempo_media",
            "casa_gols_2tempo_media",
            "casa_momentum",
            "casa_consistencia",
            "casa_forma_ataque",
            "casa_forma_defesa",
            "casa_sequencia_atual",
            "casa_gols_casa_media",
            "casa_gols_fora_media",
            "casa_mando_vantagem"
        ]
        
        # 6. FORMA RECENTE VISITANTE (20 features)
        forma_visitante = [
            "visitante_gols_marcados_media_5j",
            "visitante_gols_sofridos_media_5j",
            "visitante_total_gols_media_5j",
            "visitante_over25_last5",
            "visitante_over35_last5",
            "visitante_btts_last5",
            "visitante_vitorias_last5",
            "visitante_derrotas_last5",
            "visitante_empates_last5",
            "visitante_pontos_last5",
            "visitante_gols_1tempo_media",
            "visitante_gols_2tempo_media",
            "visitante_momentum",
            "visitante_consistencia",
            "visitante_forma_ataque",
            "visitante_forma_defesa",
            "visitante_sequencia_atual",
            "visitante_gols_casa_media",
            "visitante_gols_fora_media",
            "visitante_visitante_desvantagem"
        ]
        
        # 7. HEAD-TO-HEAD (15 features)
        h2h = [
            "h2h_total_gols_media",
            "h2h_over25_percent",
            "h2h_over35_percent",
            "h2h_btts_percent",
            "h2h_jogos_disponiveis",
            "h2h_casa_vitorias",
            "h2h_visitante_vitorias",
            "h2h_empates",
            "h2h_gols_casa_media",
            "h2h_gols_visitante_media",
            "h2h_ultimo_total_gols",
            "h2h_tendencia_gols",
            "h2h_variancia_gols",
            "h2h_maior_placar",
            "h2h_previsibilidade"
        ]
        
        # 8. FEATURES DE CONTEXTO (15 features)
        contexto = [
            "equilibrio_times",
            "favorito_intensidade",
            "azarao_intensidade",
            "probabilidade_jogo_aberto",
            "probabilidade_jogo_fechado",
            "score_ofensividade",
            "score_defensividade",
            "potencial_gols_combinado",
            "volatilidade_esperada",
            "previsibilidade_resultado",
            "importancia_jogo",
            "motivacao_casa",
            "motivacao_visitante",
            "pressao_casa",
            "pressao_visitante"
        ]
        
        # 9. FEATURES META (10 features)
        meta = [
            "confianca_dados",
            "qualidade_odds",
            "liquidez_mercado",
            "consenso_over35",
            "divergencia_mercado",
            "score_oportunidade",
            "nivel_risco",
            "kelly_criterion",
            "valor_esperado_ajustado",
            "score_entrada_recomendado"
        ]
        
        # Combinar todas
        self.feature_names = (
            core_odds + prob_odds + ratios + temporal + 
            forma_casa + forma_visitante + h2h + contexto + meta
        )
        
        logger.info(f"✅ Feature Extractor V2 inicializado: {len(self.feature_names)} features")
    
    def extract(self, match: Dict) -> np.ndarray:
        """
        Extrai features AVANÇADAS focadas em QUALIDADE.
        
        Args:
            match: Dados da partida com odds e metadados
            
        Returns:
            np.ndarray com todas as features
        """
        features = {}
        markets = match.get("markets", {})
        
        # 1. ODDS PRINCIPAIS
        features.update(self._extract_core_odds(markets))
        
        # 2. PROBABILIDADES
        features.update(self._extract_probabilities(markets))
        
        # 3. RATIOS E COMBINAÇÕES
        features.update(self._extract_ratios_and_combos(markets))
        
        # 4. FEATURES TEMPORAIS
        features.update(self._extract_temporal_features(match))
        
        # 5. FORMA RECENTE (se disponível)
        features.update(self._extract_team_form(match, 'casa'))
        features.update(self._extract_team_form(match, 'visitante'))
        
        # 6. HEAD-TO-HEAD
        features.update(self._extract_h2h_features(match))
        
        # 7. CONTEXTO
        features.update(self._extract_context_features(match, markets))
        
        # 8. META FEATURES
        features.update(self._extract_meta_features(match, markets, features))
        
        # Converter para array ordenado
        feature_array = np.array([
            features.get(name, 0.0) for name in self.feature_names
        ], dtype=np.float32)
        
        # Normalizar
        feature_array = np.nan_to_num(feature_array, 0.0)
        feature_array = np.clip(feature_array, -10, 10)
        
        self.stats['total_extractions'] += 1
        
        return feature_array
    
    def _extract_core_odds(self, markets: Dict) -> Dict:
        """Extrai odds principais (converte strings em float)"""
        
        def safe_float(value, default=0.0):
            """Converte para float de forma segura"""
            try:
                if value is None:
                    return default
                return float(value)
            except (ValueError, TypeError):
                return default
        
        return {
            "odd_over15": safe_float(markets.get("TotalGols_MaisDe_15")),
            "odd_over25": safe_float(markets.get("TotalGols_MaisDe_25")),
            "odd_over35": safe_float(markets.get("TotalGols_MaisDe_35")),
            "odd_over45": safe_float(markets.get("TotalGols_MaisDe_45")),
            "odd_under15": safe_float(markets.get("TotalGols_MenosDe_15")),
            "odd_under25": safe_float(markets.get("TotalGols_MenosDe_25")),
            "odd_under35": safe_float(markets.get("TotalGols_MenosDe_35")),
            "odd_under45": safe_float(markets.get("TotalGols_MenosDe_45")),
            "odd_btts_yes": safe_float(markets.get("AmbasEquipesMarcam_Sim")),
            "odd_btts_no": safe_float(markets.get("AmbasEquipesMarcam_Nao")),
            "odd_casa": safe_float(markets.get("Resultado_Casa")),
            "odd_empate": safe_float(markets.get("Resultado_Empate")),
            "odd_visitante": safe_float(markets.get("Resultado_Visitante")),
            "odd_dnb_casa": safe_float(markets.get("DNB_Casa")),
            "odd_dnb_visitante": safe_float(markets.get("DNB_Visitante")),
            "odd_dc_casa_empate": safe_float(markets.get("DuplaChance_CasaEmpate")),
            "odd_dc_casa_visitante": safe_float(markets.get("DuplaChance_CasaVisitante")),
            "odd_dc_empate_visitante": safe_float(markets.get("DuplaChance_EmpateVisitante")),
            "odd_over_corner_85": safe_float(markets.get("Escanteios_MaisDe_85")),
            "odd_under_corner_85": safe_float(markets.get("Escanteios_MenosDe_85")),
        }
    
    def _extract_probabilities(self, markets: Dict) -> Dict:
        """Converte odds em probabilidades implícitas (lida com strings)"""
        probs = {}
        
        for key, odd in markets.items():
            try:
                odd_float = float(odd) if odd else 0
                if odd_float > 0:
                    prob_name = f"prob_{key.lower()}"
                    probs[prob_name] = 1.0 / odd_float
            except (ValueError, TypeError, ZeroDivisionError):
                pass
        
        return probs
    
    def _extract_ratios_and_combos(self, markets: Dict) -> Dict:
        """Calcula ratios e combinações AVANÇADAS (converte strings)"""
        
        # Função auxiliar para converter
        def safe_float(value, default=0.0):
            try:
                return float(value) if value else default
            except (ValueError, TypeError):
                return default
        
        over35 = safe_float(markets.get("TotalGols_MaisDe_35"))
        under35 = safe_float(markets.get("TotalGols_MenosDe_35"))
        over25 = safe_float(markets.get("TotalGols_MaisDe_25"))
        under25 = safe_float(markets.get("TotalGols_MenosDe_25"))
        over45 = safe_float(markets.get("TotalGols_MaisDe_45"))
        btts_yes = safe_float(markets.get("AmbasEquipesMarcam_Sim"))
        btts_no = safe_float(markets.get("AmbasEquipesMarcam_Nao"))
        casa = safe_float(markets.get("Resultado_Casa"))
        empate = safe_float(markets.get("Resultado_Empate"))
        visitante = safe_float(markets.get("Resultado_Visitante"))
        
        def safe_ratio(a, b):
            return a / b if b > 0 else 0
        
        return {
            # Ratios básicos
            "ratio_over35_under35": safe_ratio(over35, under35),
            "ratio_over25_under25": safe_ratio(over25, under25),
            "ratio_over45_under45": safe_ratio(over45, safe_float(markets.get("TotalGols_MenosDe_45"))),
            "ratio_casa_visitante": safe_ratio(casa, visitante),
            "ratio_over35_casa": safe_ratio(over35, casa),
            "ratio_over35_visitante": safe_ratio(over35, visitante),
            "ratio_btts_yes_no": safe_ratio(btts_yes, btts_no),
            "ratio_over35_btts_yes": safe_ratio(over35, btts_yes),
            "ratio_over35_empate": safe_ratio(over35, empate),
            "ratio_over25_over35": safe_ratio(over25, over35),
            "ratio_over35_over45": safe_ratio(over35, over45),
            
            # Combinações avançadas
            "combo_over35_btts": over35 * btts_yes if over35 > 0 and btts_yes > 0 else 0,
            "combo_over25_over35": over25 * over35 if over25 > 0 and over35 > 0 else 0,
            "combo_casa_over25": casa * over25 if casa > 0 and over25 > 0 else 0,
            "combo_visitante_over25": visitante * over25 if visitante > 0 and over25 > 0 else 0,
            "combo_empate_under25": empate * under25 if empate > 0 and under25 > 0 else 0,
            
            # Valor esperado
            "valor_esperado_over35": (1/over35 - 1/under35) if over35 > 0 and under35 > 0 else 0,
            "valor_esperado_over25": (1/over25 - 1/under25) if over25 > 0 and under25 > 0 else 0,
            "valor_esperado_btts": (1/btts_yes - 1/btts_no) if btts_yes > 0 and btts_no > 0 else 0,
            
            # Edge (vantagem sobre a casa)
            "edge_over35": (1/over35 - 1/(over35+under35)) if over35 > 0 and under35 > 0 else 0,
            "edge_over25": (1/over25 - 1/(over25+under25)) if over25 > 0 and under25 > 0 else 0,
            
            # Desvios e qualidade
            "desvio_odd_over35": abs(over35 - 3.5) / 3.5 if over35 > 0 else 0,
            "desvio_odd_casa": abs(casa - 2.0) / 2.0 if casa > 0 else 0,
            "score_qualidade_odd": 1 / (1 + abs(over35 - 3.0)) if over35 > 0 else 0,
            "score_desequilibrio": abs(casa - visitante) / max(casa, visitante) if casa > 0 and visitante > 0 else 0,
            "score_valor": safe_ratio(over35, under35) - 1.0,
            "score_confianca_over35": 1 / over35 if over35 > 0 else 0,
            
            # Probabilidades de múltiplos gols
            "probabilidade_4plus_gols": 1 / over45 if over45 > 0 else 0,
            "probabilidade_5plus_gols": (1 / safe_float(markets.get("TotalGols_MaisDe_55"))) if safe_float(markets.get("TotalGols_MaisDe_55")) > 0 else 0,
            
            # Margem da casa
            "margem_casa": (1/over35 + 1/under35 - 1) if over35 > 0 and under35 > 0 else 0,
        }
    
    def _extract_temporal_features(self, match: Dict) -> Dict:
        """Features temporais avançadas"""
        
        hour = match.get("hour", 0)
        minute = match.get("minute", 0)
        dia_semana = match.get("dia_semana", 0)
        
        return {
            "hour": hour,
            "is_primetime": 1 if 19 <= hour <= 22 else 0,
            "is_weekend": 1 if dia_semana in [5, 6] else 0,
            "is_night": 1 if hour >= 20 or hour <= 2 else 0,
            "dia_semana": dia_semana,
            "hora_normalizada": hour / 24.0,
            "periodo_dia": (hour // 6),  # 0-3 (madrugada, manhã, tarde, noite)
            "is_horario_nobre_apostas": 1 if 14 <= hour <= 23 else 0,
            "minuto_jogo": minute,
            "fase_jogo": minute / 90.0 if minute <= 90 else 1.0,
            "tempo_desde_inicio": minute / 60.0,
            "is_final_campeonato": 0,  # TODO: Adicionar lógica
            "densidade_jogos_hora": 0,  # TODO: Contar jogos simultâneos
            "jogos_simultaneos": 0,
            "intervalo_proximo_jogo": 0,
        }
    
    def _extract_team_form(self, match: Dict, team: str) -> Dict:
        """
        Extrai forma recente do time (últimos 5 jogos).
        
        TODO: Implementar busca no banco de dados
        Por enquanto retorna valores padrão
        """
        prefix = team
        
        # Valores padrão (MOCK - substituir por dados reais)
        return {
            f"{prefix}_gols_marcados_media_5j": 1.5,
            f"{prefix}_gols_sofridos_media_5j": 1.2,
            f"{prefix}_total_gols_media_5j": 2.7,
            f"{prefix}_over25_last5": 0.6,
            f"{prefix}_over35_last5": 0.4,
            f"{prefix}_btts_last5": 0.5,
            f"{prefix}_vitorias_last5": 0.4,
            f"{prefix}_derrotas_last5": 0.3,
            f"{prefix}_empates_last5": 0.3,
            f"{prefix}_pontos_last5": 7.0,
            f"{prefix}_gols_1tempo_media": 0.8,
            f"{prefix}_gols_2tempo_media": 0.9,
            f"{prefix}_momentum": 0.5,
            f"{prefix}_consistencia": 0.6,
            f"{prefix}_forma_ataque": 0.5,
            f"{prefix}_forma_defesa": 0.5,
            f"{prefix}_sequencia_atual": 0.0,
            f"{prefix}_gols_casa_media": 1.6,
            f"{prefix}_gols_fora_media": 1.3,
            f"{prefix}_{'mando_vantagem' if team == 'casa' else 'visitante_desvantagem'}": 0.3,
        }
    
    def _extract_h2h_features(self, match: Dict) -> Dict:
        """
        Extrai features de head-to-head.
        
        TODO: Implementar busca no banco
        Por enquanto retorna valores padrão
        """
        return {
            "h2h_total_gols_media": 2.8,
            "h2h_over25_percent": 0.65,
            "h2h_over35_percent": 0.45,
            "h2h_btts_percent": 0.55,
            "h2h_jogos_disponiveis": 5,
            "h2h_casa_vitorias": 2,
            "h2h_visitante_vitorias": 2,
            "h2h_empates": 1,
            "h2h_gols_casa_media": 1.5,
            "h2h_gols_visitante_media": 1.3,
            "h2h_ultimo_total_gols": 3,
            "h2h_tendencia_gols": 0.1,
            "h2h_variancia_gols": 1.2,
            "h2h_maior_placar": 5,
            "h2h_previsibilidade": 0.6,
        }
    
    def _extract_context_features(self, match: Dict, markets: Dict) -> Dict:
        """Features de contexto do jogo"""
        
        # Função auxiliar para converter valores
        def safe_float(value, default=0.0):
            try:
                return float(value) if value else default
            except (ValueError, TypeError):
                return default
        
        casa = safe_float(markets.get("Resultado_Casa"))
        visitante = safe_float(markets.get("Resultado_Visitante"))
        empate = safe_float(markets.get("Resultado_Empate"))
        
        equilibrio = 1 / (1 + abs(casa - visitante)) if casa > 0 and visitante > 0 else 0
        
        return {
            "equilibrio_times": equilibrio,
            "favorito_intensidade": max(1/casa, 1/visitante) if casa > 0 and visitante > 0 else 0,
            "azarao_intensidade": min(1/casa, 1/visitante) if casa > 0 and visitante > 0 else 0,
            "probabilidade_jogo_aberto": equilibrio * (1/empate) if empate > 0 else 0,
            "probabilidade_jogo_fechado": (1 - equilibrio) * (1/empate) if empate > 0 else 0,
            "score_ofensividade": 0.5,  # TODO: Calcular baseado em forma
            "score_defensividade": 0.5,
            "potencial_gols_combinado": 3.0,  # TODO: Calcular
            "volatilidade_esperada": 0.5,
            "previsibilidade_resultado": 0.5,
            "importancia_jogo": 0.5,
            "motivacao_casa": 0.5,
            "motivacao_visitante": 0.5,
            "pressao_casa": 0.3,
            "pressao_visitante": 0.2,
        }
    
    def _extract_meta_features(self, match: Dict, markets: Dict, features: Dict) -> Dict:
        """Features meta sobre qualidade dos dados"""
        
        # Função auxiliar para converter valores
        def safe_float(value, default=0.0):
            try:
                return float(value) if value else default
            except (ValueError, TypeError):
                return default
        
        # Contar odds válidas (convertendo strings)
        num_odds = sum(1 for v in markets.values() if safe_float(v) > 0)
        
        over35 = safe_float(markets.get("TotalGols_MaisDe_35"))
        under35 = safe_float(markets.get("TotalGols_MenosDe_35"))
        
        # Consenso do mercado sobre over 3.5
        consenso_over35 = 1 / over35 if over35 > 0 else 0
        
        # Score de oportunidade (quanto maior, melhor a entrada)
        score_oportunidade = 0
        if over35 > 0 and under35 > 0:
            ratio = over35 / under35
            if 1.5 < ratio < 4.0:  # Faixa ótima
                score_oportunidade = 1 - abs(ratio - 2.5) / 2.5
        
        return {
            "confianca_dados": min(num_odds / 100, 1.0),
            "qualidade_odds": 1.0 if num_odds >= 50 else num_odds / 50,
            "liquidez_mercado": 0.8,  # TODO: Implementar
            "consenso_over35": consenso_over35,
            "divergencia_mercado": abs(consenso_over35 - 0.3),  # 0.3 = baseline
            "score_oportunidade": score_oportunidade,
            "nivel_risco": 1 - score_oportunidade,
            "kelly_criterion": self._calculate_kelly(over35, consenso_over35),
            "valor_esperado_ajustado": (consenso_over35 * over35) - 1,
            "score_entrada_recomendado": score_oportunidade * consenso_over35,
        }
    
    def _calculate_kelly(self, odd: float, prob_win: float) -> float:
        """Calcula Kelly Criterion"""
        if odd <= 1 or prob_win <= 0:
            return 0
        
        q = 1 - prob_win
        kelly = (prob_win * odd - 1) / (odd - 1)
        
        return max(0, min(kelly, 0.25))  # Cap at 25%
    
    def get_feature_importance(self, q_network, device='cpu') -> Dict:
        """
        Calcula importância das features usando gradientes.
        
        Args:
            q_network: Rede neural treinada
            device: 'cpu' ou 'cuda'
            
        Returns:
            Dict com importância de cada feature (ordenado)
        """
        import torch
        
        q_network.eval()
        
        # Criar input dummy
        dummy_input = torch.zeros(1, len(self.feature_names), requires_grad=True).to(device)
        
        # Forward pass
        output = q_network(dummy_input)
        
        # Backward para calcular gradientes
        output.sum().backward()
        
        # Importância = abs(gradiente)
        importance = torch.abs(dummy_input.grad).squeeze().cpu().numpy()
        
        # Normalizar
        if importance.sum() > 0:
            importance = importance / importance.sum()
        
        # Criar dict ordenado
        feature_importance = {
            name: float(imp) 
            for name, imp in zip(self.feature_names, importance)
        }
        
        # Ordenar por importância
        feature_importance = dict(
            sorted(feature_importance.items(), key=lambda x: x[1], reverse=True)
        )
        
        return feature_importance
    
    def get_feature_count(self) -> int:
        """Retorna número total de features"""
        return len(self.feature_names)
    
    def get_feature_names(self) -> List[str]:
        """Retorna lista de nomes das features"""
        return self.feature_names.copy()
    
    def print_summary(self):
        """Imprime resumo do extractor"""
        print("\n" + "="*60)
        print("📊 FEATURE EXTRACTOR V2 - RESUMO")
        print("="*60)
        print(f"Total de Features: {len(self.feature_names)}")
        print(f"Extrações realizadas: {self.stats['total_extractions']}")
        print("\nCategorias:")
        print("  • Odds principais: 20")
        print("  • Probabilidades: 20")
        print("  • Ratios e combos: 30")
        print("  • Temporais: 15")
        print("  • Forma casa: 20")
        print("  • Forma visitante: 20")
        print("  • Head-to-head: 15")
        print("  • Contexto: 15")
        print("  • Meta: 10")
        print("="*60 + "\n")


# Para compatibilidade com código antigo
AIFeatureExtractor = AdvancedFeatureExtractor