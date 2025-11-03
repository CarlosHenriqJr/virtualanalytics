"""
test_final.py - Teste final do sistema de insights

Execute após aplicar a correção para verificar se tudo funciona.

Uso:
    python test_final.py
"""

import requests
import sys

BASE_URL = "http://localhost:8000"

def test():
    print("\n" + "="*60)
    print("🧪 TESTE FINAL - Sistema de Insights")
    print("="*60 + "\n")
    
    # 1. Status
    print("1️⃣ Testando status...")
    try:
        r = requests.get(f"{BASE_URL}/ai/insights/status", timeout=5)
        if r.status_code == 200:
            data = r.json()
            print(f"   ✅ Status OK")
            print(f"   📦 Modelos: {data.get('models_found')}")
        else:
            print(f"   ❌ Status: {r.status_code}")
            return False
    except Exception as e:
        print(f"   ❌ Erro: {e}")
        print("\n💡 Certifique-se que o servidor está rodando:")
        print("   cd backend && python server.py")
        return False
    
    # 2. Melhor gatilho
    print("\n2️⃣ Testando melhor gatilho...")
    try:
        r = requests.get(f"{BASE_URL}/ai/insights/best-gatilho", timeout=30)
        
        if r.status_code == 200:
            data = r.json()
            
            if data.get('status') == 'success':
                print(f"   ✅ Gatilho obtido com sucesso!")
                
                g = data['gatilho']
                print(f"\n   🎯 RESULTADO:")
                print(f"      Odd Ideal: {g['odd_ideal']:.2f}")
                print(f"      Ratio Ideal: {g['ratio_ideal']:.2f}")
                print(f"      Win Rate: {g['win_rate_esperado']:.1f}%")
                print(f"      Stake: {g['stake_preferido']}")
                print(f"      Horários: {', '.join(map(str, g['melhores_horarios'][:3]))}h")
                
                if data.get('regras'):
                    print(f"\n   📋 Regras:")
                    for regra in data['regras'][:3]:
                        print(f"      • {regra}")
                
                return True
            else:
                print(f"   ❌ Resposta sem sucesso")
                return False
        else:
            print(f"   ❌ HTTP {r.status_code}")
            print(f"   Erro: {r.text[:200]}")
            return False
            
    except Exception as e:
        print(f"   ❌ Erro: {e}")
        return False
    
    return True


if __name__ == "__main__":
    success = test()
    
    print("\n" + "="*60)
    
    if success:
        print("🎉 SUCESSO TOTAL!")
        print("\n✅ Sistema funcionando perfeitamente!")
        print("\n🚀 Próximos passos:")
        print("   1. Abrir frontend: http://localhost:3000")
        print("   2. Ir na aba Insights")
        print("   3. Ver melhor gatilho")
        print("   4. Usar nas apostas")
        print("   5. LUCRAR! 💰")
    else:
        print("❌ TESTE FALHOU")
        print("\n💡 Verifique:")
        print("   • Servidor rodando?")
        print("   • Arquivo ai_insights_routes.py atualizado?")
        print("   • Modelo em models/?")
        print("   • Dados no MongoDB?")
    
    print("="*60 + "\n")
    
    sys.exit(0 if success else 1)
