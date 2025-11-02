"""
ai_betting_system.py - Sistema Completo de IA com Deep Q-Learning

Componentes:
1. Feature Engineering Avançado
2. Deep Q-Network (DQN)
3. Experience Replay Buffer
4. Training Engine
5. Evaluation & Metrics

Autor: Sistema de IA Profissional
"""

import torch
import torch.nn as nn
import torch.optim as optim
import numpy as np
import json
from collections import deque
from typing import List, Dict, Tuple, Optional
from dataclasses import dataclass
from datetime import datetime
import random
from .enhanced_feature_extractor import EnhancedFeatureExtractor

# ==================== CONFIGURAÇÃO ====================

@dataclass
class AIConfig:
    """Configuração da IA"""
    
    # Rede Neural
    state_size: int = 50
    action_size: int = 4  # Entrar Alto, Entrar Baixo, Pular, Hold
    hidden_sizes: List[int] = None
    
    # Aprendizado
    learning_rate: float = 0.001
    gamma: float = 0.95  # Discount factor
    epsilon_start: float = 1.0
    epsilon_end: float = 0.01
    epsilon_decay: float = 0.995
    
    # Replay Buffer
    buffer_size: int = 10000
    batch_size: int = 64
    
    # Treinamento
    target_update_freq: int = 100
    save_freq: int = 500
    
    # Trading
    initial_bankroll: float = 1000.0
    stake_high: float = 10.0
    stake_low: float = 5.0
    max_drawdown_stop: float = 0.3  # Para aos 30% de drawdown
    
    def __post_init__(self):
        if self.hidden_sizes is None:
            self.hidden_sizes = [256, 128, 64]

# ==================== FEATURE ENGINEERING ====================

class FeatureExtractor:
    """Extrai e normaliza features dos dados das partidas"""
    
    def __init__(self):
        self.feature_names = []
        self.feature_stats = {}  # Para normalização
        
    def extract(self, match_data: Dict, history: List[Dict] = None) -> np.ndarray:
        """
        Extrai todas as features relevantes de uma partida.
        
        Args:
            match_data: Dados da partida (formato do dado1.json)
            history: Histórico das últimas decisões da IA
        
        Returns:
            Array numpy com features normalizadas
        """
        markets = match_data.get("markets", {})
        
        features = {}
        
        # ========== 1. ODDS PRINCIPAIS (10 features) ==========
        
        features["odd_over35"] = markets.get("TotalGols_MaisDe_35", 0)
        features["odd_over25"] = markets.get("TotalGols_MaisDe_25", 0)
        features["odd_over45"] = markets.get("TotalGols_MaisDe_35", 0) * 1.5  # Estimativa
        features["odd_under35"] = markets.get("TotalGols_MenosDe_35", 0)
        features["odd_btts"] = markets.get("ParaOTimeMarcarSimNao_AmbasMarcam", 0)
        features["odd_casa"] = markets.get("VencedorFT_Casa", 0)
        features["odd_visitante"] = markets.get("VencedorFT_Visitante", 0)
        features["odd_empate"] = markets.get("VencedorFT_Empate", 0)
        
        # ========== 2. RATIOS ENTRE ODDS (indicadores poderosos) ==========
        
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
        
        # ========== 3. INTERVALO (HT) ==========
        
        features["intervalo_casa"] = markets.get("IntervaloVencedor_Casa", 0)
        features["intervalo_visitante"] = markets.get("IntervaloVencedor_Visitante", 0)
        features["intervalo_empate"] = markets.get("IntervaloVencedor_Empate", 0)
        features["total_gols_ht"] = markets.get("TOTAL_GOLS_HT", 0)
        
        # ========== 4. PROBABILIDADES IMPLÍCITAS (conversão de odds) ==========
        
        # Probabilidade implícita de over 3.5
        if features["odd_over35"] > 0:
            features["prob_over35"] = 1 / features["odd_over35"]
        else:
            features["prob_over35"] = 0
        
        # Probabilidades de gols exatos
        for n in range(6):
            odd_key = f"GolsExatos_{n}" if n < 5 else "GolsExatos_5_Mais"
            odd = markets.get(odd_key, 0)
            features[f"prob_{n}gols"] = (1 / odd) if odd > 0 else 0
        
        # Prob de 4+ gols (soma de 4, 5+)
        features["prob_4plus_gols"] = features["prob_4gols"] + features["prob_5gols"]
        
        # ========== 5. MARGEM DE VITÓRIA ==========
        
        features["margem_casa_3mais"] = markets.get("MargemVitoriaGols_Casa3Mais", 0)
        features["margem_visitante_3mais"] = markets.get("MargemVitoriaGols_Visitante3Mais", 0)
        
        # Odds baixas de margem alta = expectativa de muitos gols
        if features["margem_casa_3mais"] > 0:
            features["inv_margem_casa_3"] = 1 / features["margem_casa_3mais"]
        else:
            features["inv_margem_casa_3"] = 0
        
        if features["margem_visitante_3mais"] > 0:
            features["inv_margem_visitante_3"] = 1 / features["margem_visitante_3mais"]
        else:
            features["inv_margem_visitante_3"] = 0
        
        # ========== 6. TEMPORAL ==========
        
        features["hour"] = match_data.get("hour", 12)
        features["minute"] = match_data.get("minute", 0)
        
        # One-hot encoding de horário prime time
        features["is_primetime"] = 1.0 if features["hour"] in [19, 20, 21] else 0.0
        features["is_afternoon"] = 1.0 if features["hour"] in [14, 15, 16, 17] else 0.0
        features["is_morning"] = 1.0 if features["hour"] in [8, 9, 10, 11] else 0.0
        
        # ========== 7. RESULTADO CORRETO (placares esperados) ==========
        
        # Odds de placares altos
        features["resultado_4x0_casa"] = markets.get("ResultadoCorreto_Casa_4x0", 0)
        features["resultado_3x2"] = markets.get("ResultadoCorreto_Casa_3x2", 0)
        
        # ========== 8. HISTÓRICO DA IA (se disponível) ==========
        
        if history:
            # Últimos 5 resultados (1=green, 0=red)
            recent_results = [h.get("result", 0) for h in history[-5:]]
            
            # Pad com zeros se menor que 5
            while len(recent_results) < 5:
                recent_results.insert(0, 0)
            
            for i, result in enumerate(recent_results):
                features[f"last_{i+1}_result"] = float(result)
            
            # Win rate recente
            features["recent_winrate"] = sum(recent_results) / 5.0
            
            # Streak atual
            streak = 0
            for r in reversed(recent_results):
                if r == recent_results[-1]:
                    streak += 1
                else:
                    break
            features["current_streak"] = float(streak)
            
            # Bankroll normalizado
            if history:
                features["bankroll_normalized"] = history[-1].get("bankroll", 1000) / 1000.0
            else:
                features["bankroll_normalized"] = 1.0
        else:
            # Inicialização
            for i in range(5):
                features[f"last_{i+1}_result"] = 0.0
            features["recent_winrate"] = 0.5
            features["current_streak"] = 0.0
            features["bankroll_normalized"] = 1.0
        
        # ========== CONVERSÃO PARA ARRAY ==========
        
        # Salvar nomes das features (primeira vez)
        if not self.feature_names:
            self.feature_names = list(features.keys())
        
        # Converter para array na ordem correta
        feature_array = np.array([features.get(name, 0) for name in self.feature_names], dtype=np.float32)
        
        # Normalização (Z-score)
        feature_array = self._normalize(feature_array)
        
        return feature_array
    
    def _normalize(self, features: np.ndarray) -> np.ndarray:
        """Normaliza features usando Z-score"""
        
        # Calcular média e std
        if len(self.feature_stats) == 0:
            # Inicialização
            self.feature_stats = {
                "mean": features.copy(),
                "std": np.ones_like(features),
                "count": 1
            }
            return features
        
        # Atualizar estatísticas (média móvel)
        alpha = 0.01  # Taxa de atualização
        self.feature_stats["mean"] = (1 - alpha) * self.feature_stats["mean"] + alpha * features
        self.feature_stats["std"] = np.maximum(
            (1 - alpha) * self.feature_stats["std"] + alpha * np.abs(features - self.feature_stats["mean"]),
            0.01  # Mínimo para evitar divisão por zero
        )
        
        # Z-score
        normalized = (features - self.feature_stats["mean"]) / self.feature_stats["std"]
        
        # Clip para evitar outliers extremos
        normalized = np.clip(normalized, -3, 3)
        
        return normalized
    
    def get_feature_importance(self, model, device) -> Dict[str, float]:
        """Calcula importância de cada feature usando gradient"""
        
        if not self.feature_names:
            return {}
        
        # Criar input de teste
        test_input = torch.zeros(1, len(self.feature_names)).to(device)
        test_input.requires_grad = True
        
        # Forward pass
        output = model(test_input)
        
        # Backward para calcular gradientes
        output.max().backward()
        
        # Importância = magnitude do gradiente
        importance = torch.abs(test_input.grad).squeeze().cpu().numpy()
        
        # Normalizar
        importance = importance / (importance.sum() + 1e-8)
        
        # Mapear para nomes
        feature_importance = {
            name: float(imp) 
            for name, imp in zip(self.feature_names, importance)
        }
        
        # Ordenar
        feature_importance = dict(sorted(feature_importance.items(), key=lambda x: x[1], reverse=True))
        
        return feature_importance

# ==================== DEEP Q-NETWORK ====================

class DQN(nn.Module):
    """Deep Q-Network para aprendizado por reforço"""
    
    def __init__(self, state_size: int, action_size: int, hidden_sizes: List[int]):
        super(DQN, self).__init__()
        
        layers = []
        
        # Input layer
        prev_size = state_size
        
        # Hidden layers
        for hidden_size in hidden_sizes:
            layers.append(nn.Linear(prev_size, hidden_size))
            layers.append(nn.ReLU())
            layers.append(nn.Dropout(0.2))
            prev_size = hidden_size
        
        # Output layer (Q-values para cada ação)
        layers.append(nn.Linear(prev_size, action_size))
        
        self.network = nn.Sequential(*layers)
    
    def forward(self, state):
        """Forward pass"""
        return self.network(state)

# ==================== EXPERIENCE REPLAY ====================

class ReplayBuffer:
    """Buffer para armazenar experiências de treinamento"""
    
    def __init__(self, capacity: int):
        self.buffer = deque(maxlen=capacity)
    
    def push(self, state, action, reward, next_state, done):
        """Adiciona experiência ao buffer"""
        self.buffer.append((state, action, reward, next_state, done))
    
    def sample(self, batch_size: int) -> Tuple:
        """Amostra batch aleatório"""
        batch = random.sample(self.buffer, batch_size)
        
        states, actions, rewards, next_states, dones = zip(*batch)
        
        return (
            np.array(states),
            np.array(actions),
            np.array(rewards),
            np.array(next_states),
            np.array(dones)
        )
    
    def __len__(self):
        return len(self.buffer)

# ==================== BETTING AGENT ====================

class BettingAgent:
    """Agente que aprende a apostar usando DQN"""
    
    def __init__(self, config: AIConfig):
        self.config = config
        
        # Device (GPU se disponível)
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        print(f"🖥️  Usando device: {self.device}")
        
        # Feature extractor
        # self.feature_extractor = FeatureExtractor()
        self.feature_extractor = EnhancedFeatureExtractor()  # ao invés de FeatureExtractor()
        
        # Atualizar state_size baseado nas features extraídas
        dummy_match = self._create_dummy_match()
        dummy_features = self.feature_extractor.extract(dummy_match)
        self.config.state_size = len(dummy_features)
        
        # Redes
        self.policy_net = DQN(
            self.config.state_size,
            self.config.action_size,
            self.config.hidden_sizes
        ).to(self.device)
        
        self.target_net = DQN(
            self.config.state_size,
            self.config.action_size,
            self.config.hidden_sizes
        ).to(self.device)
        
        # Copiar pesos iniciais
        self.target_net.load_state_dict(self.policy_net.state_dict())
        self.target_net.eval()
        
        # Optimizer
        self.optimizer = optim.Adam(self.policy_net.parameters(), lr=self.config.learning_rate)
        
        # Replay buffer
        self.memory = ReplayBuffer(self.config.buffer_size)
        
        # Estado
        self.epsilon = self.config.epsilon_start
        self.steps_done = 0
        self.episodes_done = 0
        
        # Histórico
        self.history = []
        self.bankroll = self.config.initial_bankroll
        
        # Métricas
        self.metrics = {
            "episode_rewards": [],
            "episode_winrates": [],
            "episode_rois": [],
            "bankrolls": [],
            "losses": []
        }
    
    def _create_dummy_match(self) -> Dict:
        """Cria partida dummy para inicialização"""
        return {
            "hour": 12,
            "minute": 0,
            "markets": {
                "TotalGols_MaisDe_35": 2.0,
                "TotalGols_MaisDe_25": 1.5,
                "TotalGols_MenosDe_35": 1.8,
                "ParaOTimeMarcarSimNao_AmbasMarcam": 1.9,
                "VencedorFT_Casa": 2.2,
                "VencedorFT_Visitante": 3.0,
                "VencedorFT_Empate": 3.5,
                "IntervaloVencedor_Casa": 2.8,
                "IntervaloVencedor_Visitante": 3.5,
                "IntervaloVencedor_Empate": 2.5,
                "TOTAL_GOLS_HT": 0,
                "GolsExatos_0": 10,
                "GolsExatos_1": 5,
                "GolsExatos_2": 4,
                "GolsExatos_3": 4.5,
                "GolsExatos_4": 7,
                "GolsExatos_5_Mais": 10,
                "MargemVitoriaGols_Casa3Mais": 15,
                "MargemVitoriaGols_Visitante3Mais": 20,
                "ResultadoCorreto_Casa_4x0": 50,
                "ResultadoCorreto_Casa_3x2": 30
            }
        }
    
    def select_action(self, state: np.ndarray, training: bool = True) -> int:
        """
        Seleciona ação usando epsilon-greedy.
        
        Returns:
            0 = Entrar com Stake Alto
            1 = Entrar com Stake Baixo
            2 = Pular
            3 = Hold (aguardar mais info - não implementado ainda)
        """
        
        # Exploração (random)
        if training and random.random() < self.epsilon:
            return random.randint(0, self.config.action_size - 1)
        
        # Exploração (policy network)
        with torch.no_grad():
            state_tensor = torch.FloatTensor(state).unsqueeze(0).to(self.device)
            q_values = self.policy_net(state_tensor)
            return q_values.argmax().item()
    
    def calculate_reward(
        self, 
        action: int, 
        match_result: bool,  # True se over 3.5
        odd: float
    ) -> float:
        """
        Calcula recompensa da ação.
        
        Args:
            action: Ação tomada
            match_result: Se deu over 3.5 ou não
            odd: Odd da aposta
        
        Returns:
            Recompensa (positiva ou negativa)
        """
        
        # Stake baseado na ação
        if action == 0:  # Stake Alto
            stake = self.config.stake_high
        elif action == 1:  # Stake Baixo
            stake = self.config.stake_low
        else:  # Pular ou Hold
            stake = 0
        
        # Calcular recompensa
        if action in [0, 1]:  # Entrou
            if match_result:  # GREEN
                profit = stake * (odd - 1)
                self.bankroll += profit
                reward = profit
            else:  # RED
                self.bankroll -= stake
                reward = -stake
        else:  # Pulou
            if match_result:  # Perdeu oportunidade
                reward = -0.2  # Pequena penalidade
            else:  # Evitou loss
                reward = 0.5  # Pequena recompensa
        
        # Penalidade por drawdown
        drawdown = (self.config.initial_bankroll - self.bankroll) / self.config.initial_bankroll
        if drawdown > 0.2:
            reward -= drawdown * 2  # Penalidade proporcional
        
        return reward
    
    def store_experience(
        self, 
        state: np.ndarray, 
        action: int, 
        reward: float, 
        next_state: np.ndarray, 
        done: bool
    ):
        """Armazena experiência no replay buffer"""
        self.memory.push(state, action, reward, next_state, done)
    
    def train_step(self) -> Optional[float]:
        """
        Realiza um passo de treinamento.
        
        Returns:
            Loss ou None se buffer insuficiente
        """
        
        # Verificar se há amostras suficientes
        if len(self.memory) < self.config.batch_size:
            return None
        
        # Amostrar batch
        states, actions, rewards, next_states, dones = self.memory.sample(self.config.batch_size)
        
        # Converter para tensores
        states = torch.FloatTensor(states).to(self.device)
        actions = torch.LongTensor(actions).to(self.device)
        rewards = torch.FloatTensor(rewards).to(self.device)
        next_states = torch.FloatTensor(next_states).to(self.device)
        dones = torch.FloatTensor(dones).to(self.device)
        
        # Q-values atuais
        current_q_values = self.policy_net(states).gather(1, actions.unsqueeze(1))
        
        # Q-values próximos (target network)
        with torch.no_grad():
            next_q_values = self.target_net(next_states).max(1)[0]
            target_q_values = rewards + (1 - dones) * self.config.gamma * next_q_values
        
        # Loss (Huber loss é mais estável que MSE)
        loss = nn.SmoothL1Loss()(current_q_values.squeeze(), target_q_values)
        
        # Backpropagation
        self.optimizer.zero_grad()
        loss.backward()
        
        # Clip gradients
        torch.nn.utils.clip_grad_norm_(self.policy_net.parameters(), 1.0)
        
        self.optimizer.step()
        
        return loss.item()
    
    def update_target_network(self):
        """Atualiza target network com pesos da policy network"""
        self.target_net.load_state_dict(self.policy_net.state_dict())
    
    def decay_epsilon(self):
        """Decai epsilon (exploração → exploração)"""
        self.epsilon = max(
            self.config.epsilon_end,
            self.epsilon * self.config.epsilon_decay
        )
    
    def save_model(self, filepath: str):
        """Salva modelo treinado"""
        torch.save({
            'policy_net_state_dict': self.policy_net.state_dict(),
            'target_net_state_dict': self.target_net.state_dict(),
            'optimizer_state_dict': self.optimizer.state_dict(),
            'epsilon': self.epsilon,
            'steps_done': self.steps_done,
            'episodes_done': self.episodes_done,
            'config': self.config,
            'feature_extractor_stats': self.feature_extractor.feature_stats,
            'feature_names': self.feature_extractor.feature_names,
            'metrics': self.metrics
        }, filepath)
        print(f"💾 Modelo salvo em: {filepath}")
    
    def load_model(self, filepath: str):
        """Carrega modelo salvo"""
        checkpoint = torch.load(filepath, map_location=self.device)
        
        self.policy_net.load_state_dict(checkpoint['policy_net_state_dict'])
        self.target_net.load_state_dict(checkpoint['target_net_state_dict'])
        self.optimizer.load_state_dict(checkpoint['optimizer_state_dict'])
        self.epsilon = checkpoint['epsilon']
        self.steps_done = checkpoint['steps_done']
        self.episodes_done = checkpoint['episodes_done']
        self.feature_extractor.feature_stats = checkpoint['feature_extractor_stats']
        self.feature_extractor.feature_names = checkpoint['feature_names']
        self.metrics = checkpoint['metrics']
        
        print(f"📂 Modelo carregado de: {filepath}")