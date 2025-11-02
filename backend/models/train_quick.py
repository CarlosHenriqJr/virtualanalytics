"""
train_quick.py - Script Rápido para Treinar a IA

Uso:
    python train_quick.py

Este script:
1. Conecta ao MongoDB
2. Carrega os dados
3. Treina a IA
4. Salva o modelo
5. Avalia em dados de teste
"""

import asyncio
import sys
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient
from ai_betting_system import BettingAgent, AIConfig
from ai_training_engine import TrainingEngine

# ==================== CONFIGURAÇÃO ====================

MONGO_URI = "mongodb://localhost:27017"
DB_NAME = "futebol_virtual"

# Período de treinamento
TRAIN_START = "2025-01-01"
TRAIN_END = "2025-01-31"

# Período de teste
TEST_START = "2025-02-01"
TEST_END = "2025-02-05"

# Configuração
NUM_EPISODES = 50  # Comece com 50 para teste rápido
SAVE_INTERVAL = 10

# ==================== FUNÇÕES ====================

async def get_db():
    """Conecta ao MongoDB"""
    client = AsyncIOMotorClient(MONGO_URI)
    return client[DB_NAME]

async def check_data(db):
    """Verifica se há dados disponíveis"""
    count = await db.partidas.count_documents({
        "date": {"$gte": TRAIN_START, "$lte": TRAIN_END}
    })
    
    print(f"\n{'='*60}")
    print(f"📊 VERIFICAÇÃO DE DADOS")
    print(f"{'='*60}")
    print(f"📅 Período de treino: {TRAIN_START} a {TRAIN_END}")
    print(f"🎯 Partidas encontradas: {count}")
    print(f"{'='*60}\n")
    
    if count == 0:
        print("❌ ERRO: Nenhuma partida encontrada!")
        print("💡 Certifique-se de que:")
        print("   1. MongoDB está rodando")
        print("   2. Banco 'futebol_virtual' existe")
        print("   3. Collection 'partidas' tem dados")
        print("   4. Período configurado tem partidas\n")
        return False
    
    if count < 100:
        print("⚠️  AVISO: Poucas partidas!")
        print("💡 Recomendado: pelo menos 500 partidas para treinamento")
        print("   Considere expandir o período.\n")
    
    return True

async def main():
    """Função principal"""
    
    print(f"\n{'='*60}")
    print(f"🤖 SISTEMA DE IA - TREINAMENTO RÁPIDO")
    print(f"{'='*60}\n")
    
    # Conectar ao banco
    print("🔌 Conectando ao MongoDB...")
    db = await get_db()
    
    # Verificar dados
    if not await check_data(db):
        return
    
    print("✅ Dados OK! Iniciando treinamento...\n")
    
    # Criar engine
    engine = TrainingEngine(db)
    
    # Treinar
    try:
        await engine.train(
            num_episodes=NUM_EPISODES,
            start_date=TRAIN_START,
            end_date=TRAIN_END,
            save_interval=SAVE_INTERVAL
        )
        
        print("\n" + "="*60)
        print("✅ TREINAMENTO CONCLUÍDO!")
        print("="*60 + "\n")
        
        # Avaliar em dados de teste
        print("🔍 Avaliando modelo em dados de teste...\n")
        
        test_results = await engine.evaluate(
            model_path="models/betting_ai_final.pt",
            test_start=TEST_START,
            test_end=TEST_END
        )
        
        # Salvar resultados em arquivo
        import json
        with open('training_results.json', 'w') as f:
            json.dump({
                "training": {
                    "start_date": TRAIN_START,
                    "end_date": TRAIN_END,
                    "episodes": NUM_EPISODES
                },
                "test_results": test_results,
                "timestamp": datetime.now().isoformat()
            }, f, indent=2)
        
        print("\n" + "="*60)
        print("💾 Resultados salvos em: training_results.json")
        print("💾 Modelo salvo em: models/betting_ai_final.pt")
        print("="*60 + "\n")
        
        # Resumo final
        print("📊 RESUMO:")
        print(f"   Win Rate: {test_results['winrate']}%")
        print(f"   ROI: {test_results['roi']:+.2f}%")
        print(f"   Bankroll Final: ${test_results['final_bankroll']}")
        print(f"   Max Drawdown: {test_results['max_drawdown']}%")
        print(f"   Sharpe Ratio: {test_results['sharpe_ratio']}\n")
        
        if test_results['winrate'] >= 70:
            print("🎉 EXCELENTE! IA está performando muito bem!")
        elif test_results['winrate'] >= 60:
            print("✅ BOM! Continue treinando para melhorar.")
        else:
            print("⚠️  Performance baixa. Sugestões:")
            print("   - Aumente o número de episódios")
            print("   - Verifique se os dados têm resultados (totalGolsFT)")
            print("   - Teste com período maior de dados")
        
    except KeyboardInterrupt:
        print("\n⚠️  Treinamento interrompido pelo usuário")
    except Exception as e:
        print(f"\n❌ ERRO: {e}")
        import traceback
        traceback.print_exc()

# ==================== EXECUÇÃO ====================

if __name__ == "__main__":
    print("\n🚀 Iniciando script de treinamento...")
    print("💡 Pressione Ctrl+C para interromper\n")
    
    asyncio.run(main())