"""
ai_system - Sistema de IA para Betting

Pacote contendo:
- BettingAgent: Agente de aprendizado por reforço
- TrainingEngine: Engine de treinamento
- router: Router FastAPI com rotas da IA
- init_engine: Função para inicializar o engine
"""

from .ai_betting_system import BettingAgent, AIConfig, FeatureExtractor
from .ai_training_engine import router, init_engine, TrainingEngine

__all__ = [
    'BettingAgent',
    'AIConfig', 
    'FeatureExtractor',
    'TrainingEngine',
    'router',
    'init_engine'
]

__version__ = '1.0.0'