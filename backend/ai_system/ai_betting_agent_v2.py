"""
ai_betting_agent_v2.py - Agent MELHORADO com foco em QUALIDADE

Melhorias:
- Threshold de confiança (Q-value > 1.5)
- Sistema de recompensas avançado
- Feature extractor com 165 features
- Seletividade alta
- Win rate 60%+ como objetivo

Uso:
    agent = QualityBettingAgent(config)
    agent.train(episodes=1000)
"""

import torch
import torch.nn as nn
import torch.optim as optim
import numpy as np
from typing import Dict, Tuple, List
import logging
from collections import deque
import random

logger = logging.getLogger(__name__)


class QualityBettingAgent:
    """Agent focado em QUALIDADE sobre QUANTIDADE"""
    
    def __init__(self, config):
        self.config = config
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        
        # Feature extractor e reward system
        from ai_feature_extractor_v2 import AdvancedFeatureExtractor
        from ai_reward_system_v2 import QualityFocusedRewardSystem
        
        self.feature_extractor = AdvancedFeatureExtractor()
        self.reward_system = QualityFocusedRewardSystem(config)
        
        # Rede neural
        input_size = self.feature_extractor.get_feature_count()
        self.q_network = self._create_network(
            input_size,
            config.hidden_size,
            config.output_size
        ).to(self.device)
        
        self.target_network = self._create_network(
            input_size,
            config.hidden_size,
            config.output_size
        ).to(self.device)
        
        self.target_network.load_state_dict(self.q_network.state_dict())
        
        # Optimizer
        self.optimizer = optim.Adam(
            self.q_network.parameters(),
            lr=config.learning_rate
        )
        
        # Replay memory
        self.memory = deque(maxlen=config.memory_size)
        
        # Epsilon (exploration)
        self.epsilon = config.epsilon_start
        self.epsilon_min = config.epsilon_end
        self.epsilon_decay = config.epsilon_decay
        
        # Threshold de confiança
        self.confidence_threshold = config.confidence_threshold  # 1.5
        
        # Estatísticas
        self.stats = {
            'total_decisions': 0,
            'entries_attempted': 0,
            'entries_approved': 0,  # Passou pelo threshold
            'entries_rejected': 0,   # Rejeitado pelo threshold
            'greens': 0,
            'reds': 0,
            'win_rate': 0.0,
            'avg_confidence_green': 0.0,
            'avg_confidence_red': 0.0
        }
        
        logger.info(f"✅ QualityBettingAgent criado:")
        logger.info(f"   Input size: {input_size}")
        logger.info(f"   Confidence threshold: {self.confidence_threshold}")
        logger.info(f"   Device: {self.device}")
    
    def _create_network(self, input_size: int, hidden_size: int, output_size: int) -> nn.Module:
        """Cria rede neural"""
        
        class QNetwork(nn.Module):
            def __init__(self, input_size, hidden_size, output_size):
                super().__init__()
                self.fc1 = nn.Linear(input_size, hidden_size)
                self.fc2 = nn.Linear(hidden_size, hidden_size)
                self.fc3 = nn.Linear(hidden_size, output_size)
                self.dropout = nn.Dropout(0.2)
            
            def forward(self, x):
                x = torch.relu(self.fc1(x))
                x = self.dropout(x)
                x = torch.relu(self.fc2(x))
                x = self.dropout(x)
                return self.fc3(x)
        
        return QNetwork(input_size, hidden_size, output_size)
    
    def select_action(self, state: np.ndarray, deterministic: bool = False) -> Tuple[int, float]:
        """
        Seleciona ação com THRESHOLD de confiança.
        
        Args:
            state: Features do jogo
            deterministic: Se True, não usa epsilon (para produção)
            
        Returns:
            (action, confidence)
            
        Action:
            0 = Skip (não apostar)
            1 = Low stake
            2 = Medium stake
            3 = High stake
        """
        
        self.stats['total_decisions'] += 1
        
        # Exploration vs Exploitation
        if not deterministic and random.random() < self.epsilon:
            action = random.randint(0, self.config.output_size - 1)
            confidence = 0.0
            return action, confidence
        
        # Exploitation (usar rede)
        with torch.no_grad():
            state_tensor = torch.FloatTensor(state).unsqueeze(0).to(self.device)
            q_values = self.q_network(state_tensor).cpu().numpy()[0]
        
        # Melhor ação
        best_action = np.argmax(q_values)
        confidence = q_values[best_action]
        
        # THRESHOLD DE CONFIANÇA
        if best_action > 0:  # Quer entrar
            self.stats['entries_attempted'] += 1
            
            if confidence < self.confidence_threshold:
                # Confiança BAIXA → Força skip
                logger.debug(
                    f"⚠️  Entrada rejeitada: confidence={confidence:.2f} < {self.confidence_threshold}"
                )
                self.stats['entries_rejected'] += 1
                return 0, confidence  # Skip forçado
            
            # Confiança OK → Permite entrada
            logger.debug(f"✅ Entrada aprovada: confidence={confidence:.2f}")
            self.stats['entries_approved'] += 1
        
        return best_action, confidence
    
    def store_transition(
        self,
        state: np.ndarray,
        action: int,
        reward: float,
        next_state: np.ndarray,
        done: bool
    ):
        """Armazena transição na memória"""
        self.memory.append((state, action, reward, next_state, done))
    
    def train_step(self, batch_size: int = 32) -> float:
        """Realiza um passo de treinamento"""
        
        if len(self.memory) < batch_size:
            return 0.0
        
        # Sample batch
        batch = random.sample(self.memory, batch_size)
        states, actions, rewards, next_states, dones = zip(*batch)
        
        # Convert to tensors
        states = torch.FloatTensor(np.array(states)).to(self.device)
        actions = torch.LongTensor(actions).to(self.device)
        rewards = torch.FloatTensor(rewards).to(self.device)
        next_states = torch.FloatTensor(np.array(next_states)).to(self.device)
        dones = torch.FloatTensor(dones).to(self.device)
        
        # Current Q values
        current_q = self.q_network(states).gather(1, actions.unsqueeze(1))
        
        # Next Q values (Double DQN)
        with torch.no_grad():
            next_actions = self.q_network(next_states).argmax(1)
            next_q = self.target_network(next_states).gather(1, next_actions.unsqueeze(1))
            target_q = rewards.unsqueeze(1) + (1 - dones.unsqueeze(1)) * self.config.gamma * next_q
        
        # Loss
        loss = nn.MSELoss()(current_q, target_q)
        
        # Backprop
        self.optimizer.zero_grad()
        loss.backward()
        torch.nn.utils.clip_grad_norm_(self.q_network.parameters(), 1.0)
        self.optimizer.step()
        
        return loss.item()
    
    def update_target_network(self):
        """Atualiza target network"""
        self.target_network.load_state_dict(self.q_network.state_dict())
    
    def decay_epsilon(self):
        """Decai epsilon (exploration)"""
        self.epsilon = max(self.epsilon_min, self.epsilon * self.epsilon_decay)
    
    def evaluate(self, matches: List[Dict], verbose: bool = True) -> Dict:
        """
        Avalia agent em conjunto de partidas.
        
        Returns:
            Dict com métricas de performance
        """
        
        results = {
            'total_matches': len(matches),
            'entries': 0,
            'skips': 0,
            'greens': 0,
            'reds': 0,
            'win_rate': 0.0,
            'entry_rate': 0.0,
            'avg_confidence_green': 0.0,
            'avg_confidence_red': 0.0,
            'avg_confidence_skip': 0.0,
            'rejected_by_threshold': 0,
            'roi': 0.0,
            'profit': 0.0
        }
        
        confidences_green = []
        confidences_red = []
        confidences_skip = []
        
        total_invested = 0.0
        total_returned = 0.0
        
        for match in matches:
            # Extrair features
            features = self.feature_extractor.extract(match)
            
            # Selecionar ação (deterministic)
            action, confidence = self.select_action(features, deterministic=True)
            
            # Resultado real
            is_over = match.get("totalGolsFT", 0) > 3.5
            odd = match.get("markets", {}).get("TotalGols_MaisDe_35", 0)
            
            # Contabilizar
            if action == 0:  # Skip
                results['skips'] += 1
                confidences_skip.append(confidence)
            else:  # Entry
                results['entries'] += 1
                stake = action  # 1, 2 ou 3
                
                total_invested += stake
                
                if is_over:  # Green
                    results['greens'] += 1
                    confidences_green.append(confidence)
                    total_returned += stake * odd
                else:  # Red
                    results['reds'] += 1
                    confidences_red.append(confidence)
        
        # Calcular métricas
        if results['entries'] > 0:
            results['win_rate'] = results['greens'] / results['entries']
            results['entry_rate'] = results['entries'] / results['total_matches']
        
        if confidences_green:
            results['avg_confidence_green'] = np.mean(confidences_green)
        if confidences_red:
            results['avg_confidence_red'] = np.mean(confidences_red)
        if confidences_skip:
            results['avg_confidence_skip'] = np.mean(confidences_skip)
        
        if total_invested > 0:
            results['profit'] = total_returned - total_invested
            results['roi'] = (results['profit'] / total_invested) * 100
        
        results['rejected_by_threshold'] = self.stats['entries_rejected']
        
        if verbose:
            self._print_evaluation(results)
        
        return results
    
    def _print_evaluation(self, results: Dict):
        """Imprime resultados da avaliação"""
        print("\n" + "="*60)
        print("📊 AVALIAÇÃO DO AGENT")
        print("="*60)
        print(f"Total de Partidas: {results['total_matches']}")
        print(f"Entradas: {results['entries']} ({results['entry_rate']*100:.1f}%)")
        print(f"Pulos: {results['skips']}")
        print(f"Greens: {results['greens']}")
        print(f"Reds: {results['reds']}")
        print(f"Win Rate: {results['win_rate']*100:.1f}%")
        print(f"ROI: {results['roi']:.1f}%")
        print(f"Lucro: {results['profit']:.2f} unidades")
        print("\nConfiança Média:")
        print(f"  Greens: {results['avg_confidence_green']:.2f}")
        print(f"  Reds: {results['avg_confidence_red']:.2f}")
        print(f"  Skips: {results['avg_confidence_skip']:.2f}")
        print(f"\nRejeitados por threshold: {results['rejected_by_threshold']}")
        print("="*60)
        
        # Análise
        if results['win_rate'] >= 0.60:
            print("✅ EXCELENTE! Win rate 60%+")
        elif results['win_rate'] >= 0.50:
            print("✅ BOM! Win rate 50%+")
        elif results['win_rate'] >= 0.40:
            print("⚠️ REGULAR. Win rate 40-50%")
        else:
            print("❌ INSUFICIENTE. Win rate < 40%")
        
        if results['roi'] > 0:
            print(f"✅ LUCRATIVO! ROI +{results['roi']:.1f}%")
        else:
            print(f"❌ PREJUÍZO! ROI {results['roi']:.1f}%")
        
        print("="*60 + "\n")
    
    def save_model(self, path: str):
        """Salva modelo"""
        torch.save({
            'q_network': self.q_network.state_dict(),
            'target_network': self.target_network.state_dict(),
            'optimizer': self.optimizer.state_dict(),
            'epsilon': self.epsilon,
            'stats': self.stats,
            'config': vars(self.config)
        }, path)
        logger.info(f"💾 Modelo salvo: {path}")
    
    def load_model(self, path: str):
        """Carrega modelo"""
        checkpoint = torch.load(path, weights_only=False)
        self.q_network.load_state_dict(checkpoint['q_network'])
        self.target_network.load_state_dict(checkpoint['target_network'])
        self.optimizer.load_state_dict(checkpoint['optimizer'])
        self.epsilon = checkpoint['epsilon']
        self.stats = checkpoint.get('stats', self.stats)
        logger.info(f"📂 Modelo carregado: {path}")


class AIConfig:
    """Configuração OTIMIZADA para QUALIDADE"""
    
    def __init__(self):
        # Rede neural
        self.input_size = 165  # Feature extractor V2
        self.hidden_size = 256
        self.output_size = 4  # Skip, Low, Med, High
        
        # Treinamento
        self.learning_rate = 0.0001  # Menor = mais estável
        self.gamma = 0.99  # Discount factor
        self.batch_size = 64
        self.memory_size = 50000
        
        # Exploration
        self.epsilon_start = 1.0
        self.epsilon_end = 0.01
        self.epsilon_decay = 0.995
        
        # Threshold de confiança (CRÍTICO!)
        self.confidence_threshold = 0.0  # Q-value mínimo para entrar
        
        # Training
        self.episodes = 1000
        self.max_steps_per_episode = 500
        self.target_update_frequency = 10
        
        # Avaliação
        self.eval_frequency = 50  # A cada 50 episódios
        self.save_frequency = 100


# Alias para compatibilidade
BettingAgent = QualityBettingAgent