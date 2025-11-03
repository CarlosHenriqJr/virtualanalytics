"""
train_quality_focused.py - Treinamento FOCADO EM QUALIDADE (VERSÃO CORRIGIDA)

Objetivo: Win Rate 60%+ com alta seletividade

Uso:
    python train_quality_focused.py
    
Features:
- 165 features avançadas
- Sistema de recompensas focado em qualidade
- Threshold de confiança 1.5
- Penalização forte de reds
- Bônus por win rate alto
- Avaliação contínua

IMPORTANTE: Execute enrich_data_with_form.py ANTES de treinar!
"""

import asyncio
import sys
import os
import numpy as np
from typing import List, Dict
import logging
from datetime import datetime

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Adicionar ai_system ao path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'ai_system'))


async def load_matches_from_db(limit: int = 5000) -> List[Dict]:
    """Carrega partidas do MongoDB"""
    from database import connect_to_mongo, get_db
    
    logger.info(f"📊 Carregando {limit} partidas do banco...")
    
    await connect_to_mongo()
    db = await get_db()
    
    cursor = db.partidas.find().sort("_id", -1).limit(limit)
    matches = await cursor.to_list(length=limit)
    
    # Filtrar apenas com over 3.5 odd disponível
    matches = [
        m for m in matches 
        if m.get("markets", {}).get("TotalGols_MaisDe_35", 0) > 0
    ]
    
    logger.info(f"✅ {len(matches)} partidas carregadas (com odd over 3.5)")
    
    return matches


def split_data(matches: List[Dict], train_ratio: float = 0.8) -> tuple:
    """Divide dados em treino e teste"""
    
    split_idx = int(len(matches) * train_ratio)
    
    train_matches = matches[:split_idx]
    test_matches = matches[split_idx:]
    
    logger.info(f"📊 Dados divididos:")
    logger.info(f"   Treino: {len(train_matches)} partidas")
    logger.info(f"   Teste: {len(test_matches)} partidas")
    
    return train_matches, test_matches


def train_agent(
    agent,
    matches: List[Dict],
    episodes: int = 1000,
    eval_matches: List[Dict] = None
):
    """
    Treina agent com foco em QUALIDADE.
    
    Args:
        agent: QualityBettingAgent
        matches: Partidas de treino
        episodes: Número de episódios
        eval_matches: Partidas para avaliação (opcional)
    """
    
    logger.info("\n" + "="*60)
    logger.info("🎯 INICIANDO TREINAMENTO FOCADO EM QUALIDADE")
    logger.info("="*60)
    logger.info(f"Episódios: {episodes}")
    logger.info(f"Matches por episódio: {len(matches)}")
    logger.info(f"Confidence threshold: {agent.confidence_threshold}")
    logger.info(f"Target win rate: 60%+")
    logger.info("="*60 + "\n")
    
    best_win_rate = 0.0
    best_roi = -float('inf')
    
    for episode in range(1, episodes + 1):
        # Embaralhar matches
        np.random.shuffle(matches)
        
        # Reset reward system
        agent.reward_system.reset_episode()
        
        episode_loss = 0.0
        episode_steps = 0
        
        # Iterar por matches
        for match in matches:
            # Extrair features
            state = agent.feature_extractor.extract(match)
            
            # Selecionar ação
            action, confidence = agent.select_action(state)
            
            # Resultado real
            is_over = match.get("totalGolsFT", 0) > 3.5
            odd = match.get("markets", {}).get("TotalGols_MaisDe_35", 0)
            
            # Calcular recompensa (QUALIDADE FOCADA)
            reward, reward_info = agent.reward_system.calculate_reward(
                action=action,
                is_over=is_over,
                odd=odd,
                confidence=confidence
            )
            
            # Next state (próximo jogo - ou mesmo se não há)
            next_state = state  # Simplificado
            done = False
            
            # Armazenar transição
            agent.store_transition(state, action, reward, next_state, done)
            
            # Train step
            if len(agent.memory) >= agent.config.batch_size:
                loss = agent.train_step(agent.config.batch_size)
                episode_loss += loss
                episode_steps += 1
        
        # Decay epsilon
        agent.decay_epsilon()
        
        # Update target network
        if episode % agent.config.target_update_frequency == 0:
            agent.update_target_network()
        
        # Logging
        avg_loss = episode_loss / episode_steps if episode_steps > 0 else 0
        episode_summary = agent.reward_system.get_episode_summary()
        
        logger.info(
            f"Ep {episode:4d}/{episodes} | "
            f"Loss: {avg_loss:.4f} | "
            f"Epsilon: {agent.epsilon:.3f} | "
            f"WR: {episode_summary['win_rate']*100:5.1f}% | "
            f"Entry: {episode_summary['entry_rate']*100:5.1f}% | "
            f"Greens: {episode_summary['greens']:3d} | "
            f"Reds: {episode_summary['reds']:3d}"
        )
        
        # Avaliação periódica
        if eval_matches and episode % agent.config.eval_frequency == 0:
            logger.info("\n" + "-"*60)
            logger.info(f"📊 AVALIAÇÃO NO EPISÓDIO {episode}")
            logger.info("-"*60)
            
            eval_results = agent.evaluate(eval_matches, verbose=True)
            
            # Salvar melhor modelo (baseado em WIN RATE)
            if eval_results['win_rate'] > best_win_rate:
                best_win_rate = eval_results['win_rate']
                save_path = f"models/best_wr_model_ep{episode}.pt"
                agent.save_model(save_path)
                logger.info(f"💾 Novo melhor WIN RATE: {best_win_rate*100:.1f}%")
            
            # Salvar melhor ROI
            if eval_results['roi'] > best_roi:
                best_roi = eval_results['roi']
                save_path = f"models/best_roi_model_ep{episode}.pt"
                agent.save_model(save_path)
                logger.info(f"💰 Novo melhor ROI: {best_roi:.1f}%")
            
            logger.info("-"*60 + "\n")
        
        # Salvar checkpoint periódico
        if episode % agent.config.save_frequency == 0:
            save_path = f"models/checkpoint_ep{episode}.pt"
            agent.save_model(save_path)
    
    # Salvar modelo final
    final_path = "models/final_quality_model.pt"
    agent.save_model(final_path)
    
    logger.info("\n" + "="*60)
    logger.info("🎉 TREINAMENTO COMPLETO!")
    logger.info("="*60)
    logger.info(f"Melhor Win Rate: {best_win_rate*100:.1f}%")
    logger.info(f"Melhor ROI: {best_roi:.1f}%")
    logger.info(f"Modelo final: {final_path}")
    logger.info("="*60 + "\n")


async def main():
    """Função principal"""
    
    print("\n" + "="*70)
    print("🎯 TREINAMENTO FOCADO EM QUALIDADE - OVER 3.5 GOLS")
    print("="*70)
    print("\nObjetivo:")
    print("  • Win Rate: 60%+")
    print("  • Seletividade: 15-25% (entrar em poucos jogos)")
    print("  • ROI: Positivo e consistente")
    print("  • Threshold: Q-value > 1.5")
    print("\nRecursos:")
    print("  • 165 features avançadas")
    print("  • Sistema de recompensas focado em qualidade")
    print("  • Penalização forte de reds (-15)")
    print("  • Bônus progressivo por win rate alto")
    print("="*70 + "\n")
    
    # Criar diretório de modelos
    os.makedirs("models", exist_ok=True)
    
    # Carregar dados
    matches = await load_matches_from_db(limit=5000)
    
    if len(matches) < 1000:
        logger.warning("⚠️  Menos de 1000 partidas! Resultados podem ser ruins.")
        logger.warning("   Recomendado: 5000+ partidas")
    
    # Dividir dados
    train_matches, test_matches = split_data(matches, train_ratio=0.8)
    
    # Criar agent (IMPORT CORRETO!)
    from ai_system.ai_betting_agent_v2 import QualityBettingAgent, AIConfig
    
    config = AIConfig()
    agent = QualityBettingAgent(config)
    
    # Imprimir resumo das features
    agent.feature_extractor.print_summary()
    
    # Treinar
    train_agent(
        agent=agent,
        matches=train_matches,
        episodes=config.episodes,
        eval_matches=test_matches
    )
    
    # Avaliação final
    print("\n" + "="*70)
    print("📊 AVALIAÇÃO FINAL NO CONJUNTO DE TESTE")
    print("="*70 + "\n")
    
    final_results = agent.evaluate(test_matches, verbose=True)
    
    # Análise final
    print("\n" + "="*70)
    print("🎯 ANÁLISE FINAL")
    print("="*70)
    
    if final_results['win_rate'] >= 0.60:
        print("✅ OBJETIVO ATINGIDO! Win rate 60%+")
        print("   Modelo pronto para uso!")
    elif final_results['win_rate'] >= 0.50:
        print("⚠️  Win rate bom (50%+) mas abaixo do objetivo")
        print("   Considere retreinar com mais dados ou ajustar threshold")
    else:
        print("❌ Win rate insuficiente")
        print("   Ações recomendadas:")
        print("   1. Importar mais dados (10.000+ partidas)")
        print("   2. Aumentar threshold de confiança (2.0+)")
        print("   3. Ajustar sistema de recompensas")
        print("   4. Treinar por mais episódios")
    
    if final_results['roi'] > 0:
        print(f"✅ ROI positivo: +{final_results['roi']:.1f}%")
    else:
        print(f"❌ ROI negativo: {final_results['roi']:.1f}%")
    
    if final_results['entry_rate'] <= 0.25:
        print(f"✅ Seletividade boa: {final_results['entry_rate']*100:.1f}%")
    else:
        print(f"⚠️  Pouco seletivo: {final_results['entry_rate']*100:.1f}%")
    
    print("="*70 + "\n")
    
    # Recomendações
    print("💡 PRÓXIMOS PASSOS:")
    print()
    
    if final_results['win_rate'] >= 0.60 and final_results['roi'] > 0:
        print("1. ✅ Modelo aprovado para uso!")
        print("2. 📊 Faça backtesting em dados novos")
        print("3. 📝 Papel trading por 1-2 semanas")
        print("4. 💰 Use com dinheiro real (stake baixo inicial)")
    else:
        print("1. ❌ NÃO use este modelo ainda")
        print("2. 📊 Importe mais dados (5000-10000 partidas)")
        print("3. 🔧 Ajuste threshold de confiança")
        print("4. 🔄 Retreine com novos parâmetros")
    
    print("\n" + "="*70 + "\n")


if __name__ == "__main__":
    asyncio.run(main())