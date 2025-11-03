"""
fix_everything.py - Corrige TUDO automaticamente

Este script:
1. Instala todas as dependências
2. Verifica se está tudo OK
3. Mostra próximos passos

Uso:
    python fix_everything.py
"""

import subprocess
import sys
import os

def run(cmd):
    """Executa comando"""
    print(f"▶️  {cmd}")
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"❌ Erro: {result.stderr}")
        return False
    print("✅ OK")
    return True

def main():
    print("\n" + "="*60)
    print("🔧 FIX EVERYTHING - Correção Automática")
    print("="*60)
    print("\nEste script vai:")
    print("  1. Instalar PyTorch")
    print("  2. Instalar Motor (MongoDB)")
    print("  3. Instalar FastAPI")
    print("  4. Instalar outras dependências")
    print("\n⏱️  Tempo estimado: 10-20 minutos")
    print("="*60)
    
    input("\nPressione ENTER para começar...")
    
    # Lista de comandos
    commands = [
        ("PyTorch", f"{sys.executable} -m pip install torch torchvision torchaudio"),
        ("Motor", f"{sys.executable} -m pip install motor"),
        ("FastAPI", f"{sys.executable} -m pip install fastapi uvicorn[standard]"),
        ("Outras", f"{sys.executable} -m pip install numpy pandas pymongo python-dotenv pydantic"),
    ]
    
    failed = []
    
    for name, cmd in commands:
        print(f"\n{'='*60}")
        print(f"📦 Instalando {name}...")
        print("="*60)
        
        if not run(cmd):
            failed.append(name)
    
    # Resumo
    print("\n" + "="*60)
    print("📊 RESUMO")
    print("="*60)
    
    if not failed:
        print("\n✅ TODAS AS DEPENDÊNCIAS INSTALADAS!")
        print("\n🎯 PRÓXIMOS PASSOS:")
        print("\n1. Copie o arquivo ausente:")
        print("   Windows: copy ..\\ai_feature_extractor_with_db.py ai_system\\")
        print("   Linux/Mac: cp ../ai_feature_extractor_with_db.py ai_system/")
        print("\n2. Verifique:")
        print("   python check_ready_to_train.py")
        print("\n3. Se OK, enriqueça os dados:")
        print("   python enrich_data_with_form.py")
        print("\n4. Treine:")
        print("   python train_quality_focused.py")
    else:
        print(f"\n❌ FALHAS: {', '.join(failed)}")
        print("\nTente instalar manualmente:")
        for name, cmd in commands:
            if name in failed:
                print(f"\n{name}:")
                print(f"  {cmd}")
    
    print("\n" + "="*60 + "\n")

if __name__ == "__main__":
    main()
