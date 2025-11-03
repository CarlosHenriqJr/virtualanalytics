"""
ai_feature_extractor_with_db.py - Feature Extractor que usa dados do banco

Usa dados enriquecidos (forma recente e H2H) do MongoDB.
Compatível com ai_feature_extractor_v2.py
"""

from ai_feature_extractor_v2 import AdvancedFeatureExtractor
import numpy as np
from typing import Dict


class DatabaseFeatureExtractor(AdvancedFeatureExtractor):
    """Feature Extractor que usa dados enriquecidos do MongoDB"""
    
    def __init__(self):
        super().__init__()
    
    def _extract_team_form(self, match: Dict, team: str) -> Dict:
        """
        Extrai forma recente do banco de dados (se disponível).
        
        Override do método pai para usar dados reais.
        """
        
        # Verificar se match tem dados enriquecidos
        if team == 'casa':
            form_data = match.get('forma_casa')
        else:
            form_data = match.get('forma_visitante')
        
        prefix = team
        
        # Se não tem dados enriquecidos, usar valores padrão
        if not form_data or not isinstance(form_data, dict):
            return super()._extract_team_form(match, team)
        
        # Extrair dados reais
        return {
            f"{prefix}_gols_marcados_media_5j": form_data.get('gols_marcados_media', 1.5),
            f"{prefix}_gols_sofridos_media_5j": form_data.get('gols_sofridos_media', 1.5),
            f"{prefix}_total_gols_media_5j": form_data.get('total_gols_media', 3.0),
            f"{prefix}_over25_last5": form_data.get('over25_percent', 0.5),
            f"{prefix}_over35_last5": form_data.get('over35_percent', 0.3),
            f"{prefix}_btts_last5": form_data.get('btts_percent', 0.5),
            f"{prefix}_vitorias_last5": form_data.get('vitorias', 0) / max(form_data.get('num_games', 5), 1),
            f"{prefix}_derrotas_last5": form_data.get('derrotas', 0) / max(form_data.get('num_games', 5), 1),
            f"{prefix}_empates_last5": form_data.get('empates', 0) / max(form_data.get('num_games', 5), 1),
            f"{prefix}_pontos_last5": form_data.get('pontos', 0),
            f"{prefix}_gols_1tempo_media": form_data.get('gols_marcados_media', 1.5) * 0.55,  # ~55% no 1T
            f"{prefix}_gols_2tempo_media": form_data.get('gols_marcados_media', 1.5) * 0.45,  # ~45% no 2T
            f"{prefix}_momentum": form_data.get('momentum', 0.5),
            f"{prefix}_consistencia": (form_data.get('consistencia_ataque', 0.5) + form_data.get('consistencia_defesa', 0.5)) / 2,
            f"{prefix}_forma_ataque": form_data.get('consistencia_ataque', 0.5),
            f"{prefix}_forma_defesa": form_data.get('consistencia_defesa', 0.5),
            f"{prefix}_sequencia_atual": form_data.get('momentum', 0.5) - 0.5,  # Convertido para -0.5 a +0.5
            f"{prefix}_gols_casa_media": form_data.get('gols_marcados_media', 1.5) * 1.1 if team == 'casa' else form_data.get('gols_marcados_media', 1.5) * 0.9,
            f"{prefix}_gols_fora_media": form_data.get('gols_marcados_media', 1.5) * 0.9 if team == 'casa' else form_data.get('gols_marcados_media', 1.5) * 1.1,
            f"{prefix}_{'mando_vantagem' if team == 'casa' else 'visitante_desvantagem'}": 0.15 if team == 'casa' else -0.15,
        }
    
    def _extract_h2h_features(self, match: Dict) -> Dict:
        """
        Extrai features de head-to-head do banco (se disponível).
        
        Override do método pai para usar dados reais.
        """
        
        # Verificar se match tem dados enriquecidos
        h2h_data = match.get('h2h')
        
        # Se não tem dados enriquecidos, usar valores padrão
        if not h2h_data or not isinstance(h2h_data, dict):
            return super()._extract_h2h_features(match)
        
        # Extrair dados reais
        num_games = h2h_data.get('num_games', 0)
        
        return {
            "h2h_total_gols_media": h2h_data.get('total_gols_media', 2.5),
            "h2h_over25_percent": h2h_data.get('over25_percent', 0.5),
            "h2h_over35_percent": h2h_data.get('over35_percent', 0.3),
            "h2h_btts_percent": h2h_data.get('btts_percent', 0.5),
            "h2h_jogos_disponiveis": num_games,
            "h2h_casa_vitorias": h2h_data.get('home_wins', 0),
            "h2h_visitante_vitorias": h2h_data.get('away_wins', 0),
            "h2h_empates": h2h_data.get('draws', 0),
            "h2h_gols_casa_media": h2h_data.get('home_goals_media', 1.5),
            "h2h_gols_visitante_media": h2h_data.get('away_goals_media', 1.5),
            "h2h_ultimo_total_gols": h2h_data.get('ultimo_total_gols', 0),
            "h2h_tendencia_gols": h2h_data.get('tendencia_gols', 0.0),
            "h2h_variancia_gols": h2h_data.get('variancia_gols', 1.0),
            "h2h_maior_placar": h2h_data.get('maior_placar', 5),
            "h2h_previsibilidade": h2h_data.get('previsibilidade', 0.5),
        }
    
    def extract_with_enrichment_check(self, match: Dict) -> tuple:
        """
        Extrai features e indica se usou dados enriquecidos.
        
        Returns:
            (features_array, has_enriched_data)
        """
        
        features = self.extract(match)
        
        # Verificar se tem dados enriquecidos
        has_form = bool(match.get('forma_casa') or match.get('forma_visitante'))
        has_h2h = bool(match.get('h2h'))
        has_enriched = has_form or has_h2h
        
        return features, has_enriched


# Alias para compatibilidade
AIFeatureExtractor = DatabaseFeatureExtractor
AdvancedFeatureExtractor = DatabaseFeatureExtractor