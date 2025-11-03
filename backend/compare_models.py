"""
compare_models.py - Compara modelo antigo vs novo

Uso:
    python compare_models.py models/old_model.pt models/new_model.pt
"""

import asyncio
import sys
import numpy as np
from typing import Dict, List
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def load_matches(limit: int = 1000) -> List[Dict]:
    """Carrega partidas do banco"""
    from database import connect_to_mongo, get_db
    
    await connect_to_mongo()
    db = await get_db()
    
    cursor = db.partidas.find().sort("_id", -1).limit(limit)
    matches = await cursor.to_list(length=limit)
    
    return matches


def evaluate_model(agent, matches: List[Dict], model_name: str) -> Dict:
    """Avalia modelo"""
    
    results = {
        'model_name': model_name,
        'total_matches': len(matches),
        'entries': 0,
        'skips': 0,
        'greens': 0,
        'reds': 0,
        'win_rate': 0.0,
        'entry_rate': 0.0,
        'roi': 0.0,
        'profit': 0.0,
        'avg_confidence_entry': 0.0,
        'high_confidence_entries': 0,  # Q-value > 2.0
        'low_confidence_entries': 0    # Q-value < 1.0
    }
    
    confidences_entry = []
    total_invested = 0.0
    total_returned = 0.0
    
    for match in matches:
        features = agent.feature_extractor.extract(match)
        action, confidence = agent.select_action(features, deterministic=True)
        
        is_over = match.get("totalGolsFT", 0) > 3.5
        odd = match.get("markets", {}).get("TotalGols_MaisDe_35", 0)
        
        if action == 0:  # Skip
            results['skips'] += 1
        else:  # Entry
            results['entries'] += 1
            confidences_entry.append(confidence)
            
            stake = action
            total_invested += stake
            
            if confidence > 2.0:
                results['high_confidence_entries'] += 1
            elif confidence < 1.0:
                results['low_confidence_entries'] += 1
            
            if is_over:
                results['greens'] += 1
                total_returned += stake * odd
            else:
                results['reds'] += 1
    
    # Calcular métricas
    if results['entries'] > 0:
        results['win_rate'] = results['greens'] / results['entries']
        results['entry_rate'] = results['entries'] / results['total_matches']
        results['avg_confidence_entry'] = np.mean(confidences_entry)
    
    if total_invested > 0:
        results['profit'] = total_returned - total_invested
        results['roi'] = (results['profit'] / total_invested) * 100
    
    return results


def print_comparison(old_results: Dict, new_results: Dict):
    """Imprime comparação detalhada"""
    
    print("\n" + "="*90)
    print("📊 COMPARAÇÃO: MODELO ANTIGO vs MODELO NOVO")
    print("="*90)
    
    print(f"\n{'Métrica':<35} {'Antigo':>20} {'Novo':>20} {'Melhoria':>10}")
    print("-" * 90)
    
    metrics = [
        ('Total de Partidas', 'total_matches', False, ''),
        ('Entradas', 'entries', False, ''),
        ('Entry Rate', 'entry_rate', False, '%'),
        ('Greens', 'greens', False, ''),
        ('Reds', 'reds', False, ''),
        ('Win Rate', 'win_rate', False, '%'),
        ('ROI', 'roi', False, '%'),
        ('Lucro (unidades)', 'profit', False, ''),
        ('Confiança Média (entradas)', 'avg_confidence_entry', False, ''),
        ('Entradas Alta Confiança', 'high_confidence_entries', False, ''),
        ('Entradas Baixa Confiança', 'low_confidence_entries', True, ''),  # Menos é melhor
    ]
    
    for metric_name, key, less_is_better, unit in metrics:
        old_val = old_results[key]
        new_val = new_results[key]
        
        # Formatar valores
        if unit == '%':
            old_str = f"{old_val*100:>18.1f}%"
            new_str = f"{new_val*100:>18.1f}%"
            diff = (new_val - old_val) * 100
            diff_str = f"{diff:+.1f}pp"
        else:
            old_str = f"{old_val:>20.2f}"
            new_str = f"{new_val:>20.2f}"
            
            if old_val != 0:
                diff_pct = ((new_val - old_val) / abs(old_val)) * 100
                diff_str = f"{diff_pct:+.1f}%"
            else:
                diff_str = "N/A"
        
        # Símbolo de melhoria
        if key in ['total_matches']:
            symbol = ""
        elif less_is_better:
            symbol = "✅" if new_val < old_val else ("❌" if new_val > old_val else "➖")
        else:
            symbol = "✅" if new_val > old_val else ("❌" if new_val < old_val else "➖")
        
        print(f"{metric_name:<35} {old_str} {new_str} {diff_str:>9} {symbol}")
    
    print("="*90)
    
    # Resumo
    print("\n🎯 RESUMO DA MELHORIA:")
    print("-" * 90)
    
    # Win rate
    wr_diff = (new_results['win_rate'] - old_results['win_rate']) * 100
    if wr_diff > 10:
        print(f"✅ Win Rate: MELHORIA EXCELENTE (+{wr_diff:.1f}pp)")
    elif wr_diff > 5:
        print(f"✅ Win Rate: Boa melhoria (+{wr_diff:.1f}pp)")
    elif wr_diff > 0:
        print(f"⚠️  Win Rate: Pequena melhoria (+{wr_diff:.1f}pp)")
    else:
        print(f"❌ Win Rate: Piorou ({wr_diff:.1f}pp)")
    
    # ROI
    roi_diff = new_results['roi'] - old_results['roi']
    if new_results['roi'] > 0 and old_results['roi'] <= 0:
        print(f"✅ ROI: VIROU LUCRATIVO! ({old_results['roi']:.1f}% → {new_results['roi']:.1f}%)")
    elif roi_diff > 5:
        print(f"✅ ROI: Melhoria significativa (+{roi_diff:.1f}pp)")
    elif roi_diff > 0:
        print(f"✅ ROI: Pequena melhoria (+{roi_diff:.1f}pp)")
    else:
        print(f"❌ ROI: Piorou ({roi_diff:.1f}pp)")
    
    # Seletividade
    entry_diff = (new_results['entry_rate'] - old_results['entry_rate']) * 100
    if entry_diff < -20:
        print(f"✅ Seletividade: MUITO MAIS SELETIVO ({entry_diff:.1f}pp)")
    elif entry_diff < -5:
        print(f"✅ Seletividade: Mais seletivo ({entry_diff:.1f}pp)")
    elif entry_diff < 5:
        print(f"➖ Seletividade: Semelhante ({entry_diff:.1f}pp)")
    else:
        print(f"⚠️  Seletividade: Menos seletivo ({entry_diff:.1f}pp)")
    
    # Confiança
    conf_diff = new_results['avg_confidence_entry'] - old_results['avg_confidence_entry']
    if conf_diff > 0.5:
        print(f"✅ Confiança: MUITO MAIOR (+{conf_diff:.2f})")
    elif conf_diff > 0:
        print(f"✅ Confiança: Maior (+{conf_diff:.2f})")
    else:
        print(f"⚠️  Confiança: Menor ({conf_diff:.2f})")
    
    print("-" * 90)
    
    # Veredito final
    print("\n🏆 VEREDITO FINAL:")
    print("-" * 90)
    
    improvements = 0
    if wr_diff > 5: improvements += 1
    if roi_diff > 5: improvements += 1
    if entry_diff < -5: improvements += 1
    if conf_diff > 0.5: improvements += 1
    
    if improvements >= 3:
        print("✅ MODELO NOVO É SIGNIFICATIVAMENTE MELHOR!")
        print("   Recomendação: USE O MODELO NOVO")
    elif improvements >= 2:
        print("✅ Modelo novo é melhor")
        print("   Recomendação: Considere usar o modelo novo")
    elif improvements >= 1:
        print("⚠️  Modelo novo tem algumas melhorias")
        print("   Recomendação: Teste mais antes de decidir")
    else:
        print("❌ Modelo novo não apresentou melhorias claras")
        print("   Recomendação: Continue usando modelo antigo ou retreine")
    
    print("="*90 + "\n")


async def main():
    """Função principal"""
    
    if len(sys.argv) < 3:
        print("\n❌ Uso: python compare_models.py <modelo_antigo.pt> <modelo_novo.pt>\n")
        print("Exemplo:")
        print("  python compare_models.py models/betting_ai_final_old.pt models/best_wr_model_ep50.pt\n")
        sys.exit(1)
    
    old_model_path = sys.argv[1]
    new_model_path = sys.argv[2]
    
    print("\n" + "="*90)
    print("🔬 COMPARAÇÃO DE MODELOS")
    print("="*90)
    print(f"Modelo Antigo: {old_model_path}")
    print(f"Modelo Novo: {new_model_path}")
    print("="*90 + "\n")
    
    # Carregar matches
    logger.info("📊 Carregando partidas...")
    matches = await load_matches(limit=1000)
    logger.info(f"✅ {len(matches)} partidas carregadas")
    
    # Carregar e avaliar modelo antigo
    logger.info("\n📂 Carregando modelo antigo...")
    from ai_betting_agent_v2 import QualityBettingAgent, AIConfig
    
    config = AIConfig()
    old_agent = QualityBettingAgent(config)
    
    try:
        old_agent.load_model(old_model_path)
        logger.info("✅ Modelo antigo carregado")
        
        logger.info("📊 Avaliando modelo antigo...")
        old_results = evaluate_model(old_agent, matches, "Antigo")
        logger.info("✅ Avaliação completa")
    except Exception as e:
        logger.error(f"❌ Erro ao carregar modelo antigo: {e}")
        sys.exit(1)
    
    # Carregar e avaliar modelo novo
    logger.info("\n📂 Carregando modelo novo...")
    new_agent = QualityBettingAgent(config)
    
    try:
        new_agent.load_model(new_model_path)
        logger.info("✅ Modelo novo carregado")
        
        logger.info("📊 Avaliando modelo novo...")
        new_results = evaluate_model(new_agent, matches, "Novo")
        logger.info("✅ Avaliação completa")
    except Exception as e:
        logger.error(f"❌ Erro ao carregar modelo novo: {e}")
        sys.exit(1)
    
    # Imprimir comparação
    print_comparison(old_results, new_results)


if __name__ == "__main__":
    asyncio.run(main())
