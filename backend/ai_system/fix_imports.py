"""
fix_imports.py - Corrige imports relativos automaticamente

Execute este script na pasta backend/ para corrigir todos os imports.

Uso:
    cd backend
    python fix_imports.py
"""

import os
import re

def fix_file_imports(filepath):
    """Corrige imports em um arquivo específico"""
    
    if not os.path.exists(filepath):
        print(f"❌ Arquivo não encontrado: {filepath}")
        return False
    
    print(f"🔍 Verificando: {filepath}")
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original_content = content
    changes_made = False
    
    # Padrões de imports a corrigir
    fixes = [
        # temporal_block_analysis sem ponto
        (
            r'^from temporal_block_analysis import',
            'from .temporal_block_analysis import'
        ),
        # enhanced_feature_extractor sem ponto
        (
            r'^from enhanced_feature_extractor import',
            'from .enhanced_feature_extractor import'
        ),
        # ai_betting_system sem ponto
        (
            r'^from ai_betting_system import',
            'from .ai_betting_system import'
        ),
        # ai_training_engine sem ponto
        (
            r'^from ai_training_engine import',
            'from .ai_training_engine import'
        ),
    ]
    
    for pattern, replacement in fixes:
        new_content = re.sub(pattern, replacement, content, flags=re.MULTILINE)
        if new_content != content:
            print(f"  ✅ Corrigido: {pattern.replace('^from ', '')}")
            content = new_content
            changes_made = True
    
    if changes_made:
        # Fazer backup
        backup_path = filepath + '.backup'
        with open(backup_path, 'w', encoding='utf-8') as f:
            f.write(original_content)
        print(f"  💾 Backup salvo em: {backup_path}")
        
        # Salvar corrigido
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"  ✅ Arquivo corrigido!")
        return True
    else:
        print(f"  ℹ️  Nenhuma correção necessária")
        return False

def main():
    print("\n" + "="*60)
    print("🔧 CORRETOR AUTOMÁTICO DE IMPORTS")
    print("="*60 + "\n")
    
    # Arquivos para verificar
    files_to_check = [
        'ai_system/enhanced_feature_extractor.py',
        'ai_system/temporal_block_analysis.py',
        'ai_system/ai_betting_system.py',
        'ai_system/ai_training_engine.py',
    ]
    
    total_fixed = 0
    
    for filepath in files_to_check:
        if fix_file_imports(filepath):
            total_fixed += 1
        print()
    
    print("="*60)
    if total_fixed > 0:
        print(f"✅ {total_fixed} arquivo(s) corrigido(s)!")
        print()
        print("🔄 Próximos passos:")
        print("  1. Reinicie o servidor (Ctrl+C e python server.py)")
        print("  2. Teste: http://localhost:8000/ai/status")
    else:
        print("ℹ️  Nenhuma correção necessária - imports já estão corretos!")
    print("="*60 + "\n")

if __name__ == "__main__":
    main()
