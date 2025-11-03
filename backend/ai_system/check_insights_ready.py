"""
check_insights_ready.py - Verifica se sistema está pronto para usar Insights

Execute antes de usar o dashboard de insights.

Uso:
    python check_insights_ready.py
"""

import os
import sys
import asyncio

async def check_all():
    print("\n" + "="*60)
    print("🔍 VERIFICAÇÃO DO SISTEMA DE INSIGHTS")
    print("="*60 + "\n")
    
    all_ok = True
    
    # 1. Verificar pasta models
    print("1️⃣ Verificando pasta models/...")
    if not os.path.exists("models"):
        print("   ❌ Pasta 'models/' não encontrada")
        print("   💡 Crie com: mkdir models")
        all_ok = False
    else:
        print("   ✅ Pasta models/ existe")
    
    # 2. Verificar se tem modelos
    print("\n2️⃣ Verificando modelos treinados...")
    if os.path.exists("models"):
        model_files = [f for f in os.listdir("models") if f.endswith(('.pt', '.pth'))]
        
        if not model_files:
            print("   ❌ Nenhum modelo encontrado")
            print("   💡 Treine a IA com: python train_quick.py")
            all_ok = False
        else:
            print(f"   ✅ {len(model_files)} modelo(s) encontrado(s):")
            for f in model_files[:5]:
                size_mb = os.path.getsize(os.path.join("models", f)) / (1024*1024)
                print(f"      • {f} ({size_mb:.1f} MB)")
    
    # 3. Verificar arquivos da IA
    print("\n3️⃣ Verificando arquivos da IA...")
    
    required_files = [
        "ai_system/ai_betting_system.py",
        "ai_system/ai_insights_analyzer.py",
        "ai_system/ai_insights_routes.py"
    ]
    
    for file_path in required_files:
        if not os.path.exists(file_path):
            print(f"   ❌ {file_path} não encontrado")
            all_ok = False
        else:
            # Verificar se tem a função/classe necessária
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            if 'ai_insights_routes.py' in file_path:
                if '_engine_instance' in content:
                    print(f"   ⚠️  {file_path} está desatualizado (usa _engine_instance)")
                    print(f"      💡 Substitua pela versão corrigida: ai_insights_routes_FIXED.py")
                    all_ok = False
                else:
                    print(f"   ✅ {file_path}")
            else:
                print(f"   ✅ {file_path}")
    
    # 4. Verificar MongoDB
    print("\n4️⃣ Verificando conexão com MongoDB...")
    try:
        from database import connect_to_mongo, get_db
        await connect_to_mongo()
        db = await get_db()
        
        count = await db.partidas.count_documents({})
        
        if count == 0:
            print("   ⚠️  MongoDB conectado, mas sem dados")
            print("   💡 Importe dados primeiro")
            all_ok = False
        else:
            print(f"   ✅ MongoDB conectado ({count} partidas)")
    except Exception as e:
        print(f"   ❌ Erro ao conectar MongoDB: {e}")
        all_ok = False
    
    # 5. Verificar se pode carregar modelo
    print("\n5️⃣ Testando carregamento de modelo...")
    try:
        from ai_system.ai_betting_system import BettingAgent, AIConfig
        
        if os.path.exists("models") and model_files:
            # Tentar carregar o primeiro modelo
            test_model_path = os.path.join("models", model_files[0])
            
            agent = BettingAgent(AIConfig())
            agent.load_model(test_model_path)
            
            print(f"   ✅ Modelo carregado com sucesso: {model_files[0]}")
        else:
            print("   ⏭️  Pulado (sem modelos)")
    
    except Exception as e:
        print(f"   ❌ Erro ao carregar modelo: {e}")
        all_ok = False
    
    # Resultado final
    print("\n" + "="*60)
    if all_ok:
        print("🎉 TUDO OK! Sistema pronto para usar Insights!")
        print("\n📊 Próximos passos:")
        print("   1. Iniciar servidor: python server.py")
        print("   2. Abrir frontend: http://localhost:3000")
        print("   3. Ir na aba: 💡 Insights da IA")
        print("   4. Ver o melhor gatilho! 🎯")
    else:
        print("❌ CORREÇÕES NECESSÁRIAS")
        print("\n💡 Veja as mensagens acima e corrija os problemas.")
        print("\n📚 Guias úteis:")
        print("   • CORRECAO_ENGINE_INSTANCE.md - Corrigir erro _engine_instance")
        print("   • GUIA_INSIGHTS_IA.md - Guia completo de insights")
    
    print("="*60 + "\n")
    
    return 0 if all_ok else 1

if __name__ == "__main__":
    sys.exit(asyncio.run(check_all()))