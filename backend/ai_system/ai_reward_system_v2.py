"""
ai_reward_system_v2.py - Sistema de Recompensas AVANÇADO

Foco:
- Win Rate 60%+ (não quantidade)
- Penaliza reds FORTEMENTE
- Recompensa seletividade
- Bônus por confiança alta
- Penaliza entrada em jogos ruins

Objetivo: Ensinar IA a ser SELETIVA e PRECISA
"""

import numpy as np
from typing import Dict, Tuple
import logging

logger = logging.getLogger(__name__)


class QualityFocusedRewardSystem:
    """Sistema de recompensas focado em QUALIDADE sobre QUANTIDADE"""
    
    def __init__(self, config=None):
        self.config = config or {}
        
        # Parâmetros de recompensa
        self.GREEN_REWARD = 10.0  # Recompensa base por green
        self.RED_PENALTY = -15.0  # Penalidade FORTE por red
        self.SKIP_REWARD = 0.2    # Pequena recompensa por pular
        
        # Multiplicadores
        self.HIGH_CONFIDENCE_BONUS = 2.0  # Bônus se Q-value alto
        self.LOW_CONFIDENCE_PENALTY = 0.5  # Penalidade se Q-value baixo
        self.SELECTIVITY_BONUS = 1.5  # Bônus por ser seletivo
        
        # Thresholds
        self.MIN_ODD_FOR_ENTRY = 2.5  # Odd mínima recomendada
        self.MAX_ODD_FOR_ENTRY = 5.0  # Odd máxima recomendada
        self.TARGET_ENTRY_RATE = 0.2  # 20% dos jogos (seletivo!)
        
        # Tracking
        self.episode_stats = {
            'total_decisions': 0,
            'entries': 0,
            'skips': 0,
            'greens': 0,
            'reds': 0,
            'total_reward': 0.0,
            'win_rate': 0.0,
            'entry_rate': 0.0
        }
    
    def calculate_reward(
        self,
        action: int,
        is_over: bool,
        odd: float,
        confidence: float = 0.0,
        features: Dict = None
    ) -> Tuple[float, Dict]:
        """
        Calcula recompensa focada em QUALIDADE.
        
        Args:
            action: 0=skip, 1=low, 2=med, 3=high
            is_over: True se foi over 3.5
            odd: Odd da aposta
            confidence: Q-value da ação (confiança)
            features: Features extras para análise
            
        Returns:
            (reward, info_dict)
        """
        
        info = {
            'base_reward': 0.0,
            'confidence_modifier': 0.0,
            'odd_quality_modifier': 0.0,
            'selectivity_bonus': 0.0,
            'total_reward': 0.0,
            'reason': ''
        }
        
        # CASO 1: Pulou (skip)
        if action == 0:
            reward = self.SKIP_REWARD
            info['base_reward'] = reward
            info['reason'] = 'skip'
            
            # Bônus se pulou jogo ruim
            if not is_over:
                reward += 1.0  # Acertou em não entrar!
                info['selectivity_bonus'] = 1.0
                info['reason'] = 'skip_correto'
            
            # Penalidade se pulou jogo bom
            else:
                reward -= 0.5  # Perdeu oportunidade
                info['reason'] = 'skip_incorreto'
        
        # CASO 2: Entrou (bet)
        else:
            # GREEN
            if is_over:
                # Recompensa base
                reward = self.GREEN_REWARD
                info['base_reward'] = reward
                info['reason'] = 'green'
                
                # Bônus por odd boa (não muito alta, não muito baixa)
                if self.MIN_ODD_FOR_ENTRY <= odd <= self.MAX_ODD_FOR_ENTRY:
                    odd_bonus = 2.0
                    reward += odd_bonus
                    info['odd_quality_modifier'] = odd_bonus
                    info['reason'] = 'green_odd_ideal'
                
                # Bônus ENORME por confiança alta
                if confidence > 1.5:
                    confidence_bonus = reward * self.HIGH_CONFIDENCE_BONUS
                    reward += confidence_bonus
                    info['confidence_modifier'] = confidence_bonus
                    info['reason'] = 'green_alta_confianca'
                
                # Bônus por stake apropriado
                if action == 3 and odd >= 3.5:  # Stake alto em odd boa
                    reward *= 1.3
                    info['reason'] = 'green_stake_otimo'
                
                self.episode_stats['greens'] += 1
            
            # RED
            else:
                # Penalidade FORTE
                reward = self.RED_PENALTY
                info['base_reward'] = reward
                info['reason'] = 'red'
                
                # Penalidade EXTRA se odd ruim
                if odd > self.MAX_ODD_FOR_ENTRY:
                    reward *= 1.5  # Penalidade 50% maior
                    info['odd_quality_modifier'] = reward * 0.5
                    info['reason'] = 'red_odd_ruim'
                
                if odd < self.MIN_ODD_FOR_ENTRY:
                    reward *= 1.3
                    info['odd_quality_modifier'] = reward * 0.3
                    info['reason'] = 'red_odd_baixa'
                
                # Penalidade EXTRA se confiança baixa
                if confidence < 0.5:
                    penalty_extra = abs(reward) * 0.5
                    reward -= penalty_extra
                    info['confidence_modifier'] = -penalty_extra
                    info['reason'] = 'red_baixa_confianca'
                
                # Penalidade MAIOR por stake alto
                if action == 3:  # Stake alto em red = desastre
                    reward *= 2.0  # Penalidade DOBRADA
                    info['reason'] = 'red_stake_alto_desastre'
                
                self.episode_stats['reds'] += 1
            
            self.episode_stats['entries'] += 1
        
        # Tracking
        self.episode_stats['total_decisions'] += 1
        self.episode_stats['total_reward'] += reward
        
        # Calcular métricas
        if self.episode_stats['entries'] > 0:
            self.episode_stats['win_rate'] = (
                self.episode_stats['greens'] / self.episode_stats['entries']
            )
        
        self.episode_stats['entry_rate'] = (
            self.episode_stats['entries'] / self.episode_stats['total_decisions']
        )
        
        # Bônus por WIN RATE ALTO (progressive reward)
        if self.episode_stats['entries'] >= 10:  # Mínimo de decisões
            wr = self.episode_stats['win_rate']
            
            if wr >= 0.70:  # 70%+ WR = EXCELENTE
                bonus = reward * 3.0
                reward += bonus
                info['selectivity_bonus'] = bonus
                info['reason'] += '_wr_excelente'
            
            elif wr >= 0.60:  # 60%+ WR = ÓTIMO
                bonus = reward * 2.0
                reward += bonus
                info['selectivity_bonus'] = bonus
                info['reason'] += '_wr_otimo'
            
            elif wr >= 0.50:  # 50%+ WR = BOM
                bonus = reward * 1.0
                reward += bonus
                info['selectivity_bonus'] = bonus
                info['reason'] += '_wr_bom'
            
            elif wr < 0.40:  # <40% WR = PÉSSIMO
                penalty = abs(reward) * 2.0
                reward -= penalty
                info['selectivity_bonus'] = -penalty
                info['reason'] += '_wr_pessimo'
        
        # Bônus por SELETIVIDADE (entrar em poucos jogos)
        if self.episode_stats['total_decisions'] >= 20:
            entry_rate = self.episode_stats['entry_rate']
            
            if entry_rate <= 0.15:  # Muito seletivo (15%)
                if is_over:  # E acertou!
                    bonus = reward * 2.0
                    reward += bonus
                    info['selectivity_bonus'] += bonus
                    info['reason'] += '_muito_seletivo'
            
            elif entry_rate <= 0.25:  # Seletivo (25%)
                if is_over:
                    bonus = reward * 1.0
                    reward += bonus
                    info['selectivity_bonus'] += bonus
                    info['reason'] += '_seletivo'
            
            elif entry_rate > 0.50:  # Pouco seletivo (>50%)
                if not is_over:  # E errou!
                    penalty = abs(reward) * 1.5
                    reward -= penalty
                    info['selectivity_bonus'] -= penalty
                    info['reason'] += '_pouco_seletivo'
        
        info['total_reward'] = reward
        
        return reward, info
    
    def get_episode_summary(self) -> Dict:
        """Retorna resumo do episódio"""
        return self.episode_stats.copy()
    
    def reset_episode(self):
        """Reseta estatísticas do episódio"""
        self.episode_stats = {
            'total_decisions': 0,
            'entries': 0,
            'skips': 0,
            'greens': 0,
            'reds': 0,
            'total_reward': 0.0,
            'win_rate': 0.0,
            'entry_rate': 0.0
        }
    
    def print_summary(self):
        """Imprime resumo das recompensas"""
        stats = self.episode_stats
        
        print("\n" + "="*60)
        print("🎯 REWARD SYSTEM V2 - RESUMO DO EPISÓDIO")
        print("="*60)
        print(f"Total de Decisões: {stats['total_decisions']}")
        print(f"Entradas: {stats['entries']} ({stats['entry_rate']*100:.1f}%)")
        print(f"Pulos: {stats['skips']}")
        print(f"Greens: {stats['greens']}")
        print(f"Reds: {stats['reds']}")
        print(f"Win Rate: {stats['win_rate']*100:.1f}%")
        print(f"Recompensa Total: {stats['total_reward']:.2f}")
        print("="*60)
        
        # Análise
        if stats['entries'] > 0:
            if stats['win_rate'] >= 0.60:
                print("✅ EXCELENTE! Win rate acima de 60%")
            elif stats['win_rate'] >= 0.50:
                print("✅ BOM! Win rate acima de 50%")
            elif stats['win_rate'] >= 0.40:
                print("⚠️ REGULAR. Win rate entre 40-50%")
            else:
                print("❌ RUIM! Win rate abaixo de 40%")
            
            if stats['entry_rate'] <= 0.20:
                print("✅ Muito seletivo (ideal!)")
            elif stats['entry_rate'] <= 0.35:
                print("✅ Seletivo (bom)")
            else:
                print("⚠️ Pouco seletivo (entrou em muitos jogos)")
        
        print("="*60 + "\n")


class AdaptiveRewardSystem(QualityFocusedRewardSystem):
    """
    Sistema de recompensas que se adapta ao longo do treinamento.
    
    Início: Mais tolerante (aprende padrões)
    Meio: Balanceado
    Fim: Muito exigente (foco em qualidade)
    """
    
    def __init__(self, config=None):
        super().__init__(config)
        self.training_progress = 0.0  # 0.0 = início, 1.0 = fim
    
    def set_training_progress(self, progress: float):
        """
        Define progresso do treinamento (0.0 a 1.0).
        
        Ajusta recompensas automaticamente:
        - Início (0.0-0.3): Explora mais, aceita mais entradas
        - Meio (0.3-0.7): Balanceado
        - Fim (0.7-1.0): Foco em qualidade máxima
        """
        self.training_progress = np.clip(progress, 0.0, 1.0)
        
        # Ajustar penalidades baseado no progresso
        if progress < 0.3:  # Fase inicial
            self.RED_PENALTY = -10.0  # Mais tolerante
            self.TARGET_ENTRY_RATE = 0.35  # Aceita mais entradas
        
        elif progress < 0.7:  # Fase intermediária
            self.RED_PENALTY = -15.0
            self.TARGET_ENTRY_RATE = 0.25
        
        else:  # Fase final
            self.RED_PENALTY = -20.0  # Muito exigente
            self.TARGET_ENTRY_RATE = 0.15  # Muito seletivo
        
        logger.info(
            f"📊 Reward system ajustado: progress={progress:.1%}, "
            f"red_penalty={self.RED_PENALTY}, target_entry={self.TARGET_ENTRY_RATE:.1%}"
        )