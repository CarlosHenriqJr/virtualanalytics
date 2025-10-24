"""
Script para adicionar o endpoint de health check ao analysis_routes.py existente.

Execute este script para adicionar automaticamente o endpoint /health
ao seu arquivo analysis_routes.py sem precisar substituir tudo.
"""

import os
import sys

# Código do endpoint de health check para adicionar
HEALTH_CHECK_CODE = '''
# ==================== HEALTH CHECK ====================

@analysis_router.get("/health")
async def health_check():
    """
    Endpoint de health check para verificar a conexão com o MongoDB
    e retornar estatísticas básicas dos dados disponíveis.
    """
    try:
        db = await get_database()
        
        # Verificar se consegue acessar o banco
        # Tentar contar documentos na coleção matches
        total_matches = await db.matches.count_documents({})
        
        # Buscar data mais antiga e mais recente
        oldest_match = await db.matches.find_one({}, sort=[("date", 1)])
        newest_match = await db.matches.find_one({}, sort=[("date", -1)])
        
        return {
            "status": "connected",
            "database": "MongoDB",
            "total_matches": total_matches,
            "oldest_date": oldest_match.get("date") if oldest_match else None,
            "newest_date": newest_match.get("date") if newest_match else None,
            "message": f"Banco de dados conectado com sucesso. {total_matches} jogos disponíveis."
        }
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail=f"Erro ao conectar ao banco de dados: {str(e)}"
        )

'''

def add_health_check(file_path):
    """Adiciona o endpoint de health check ao arquivo analysis_routes.py"""
    
    if not os.path.exists(file_path):
        print(f"❌ Erro: Arquivo não encontrado: {file_path}")
        return False
    
    # Ler o arquivo atual
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Verificar se já tem o endpoint de health check
    if '@analysis_router.get("/health")' in content or '@router.get("/health")' in content:
        print("✅ O endpoint /health já existe no arquivo!")
        return True
    
    # Procurar onde adicionar (após os imports e antes das outras rotas)
    # Vamos adicionar logo após a definição do router
    
    if 'analysis_router = APIRouter' in content:
        router_line = 'analysis_router = APIRouter'
    elif 'router = APIRouter' in content:
        router_line = 'router = APIRouter'
    else:
        print("❌ Erro: Não foi possível encontrar a definição do router no arquivo")
        return False
    
    # Encontrar a posição para inserir
    lines = content.split('\n')
    insert_position = None
    
    for i, line in enumerate(lines):
        if router_line in line:
            # Procurar a próxima linha vazia após a definição do router
            for j in range(i + 1, len(lines)):
                if lines[j].strip() == '':
                    insert_position = j + 1
                    break
            break
    
    if insert_position is None:
        print("❌ Erro: Não foi possível determinar onde inserir o código")
        return False
    
    # Inserir o código do health check
    lines.insert(insert_position, HEALTH_CHECK_CODE)
    
    # Fazer backup do arquivo original
    backup_path = file_path + '.backup'
    with open(backup_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"✅ Backup criado: {backup_path}")
    
    # Escrever o novo conteúdo
    new_content = '\n'.join(lines)
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    
    print(f"✅ Endpoint /health adicionado com sucesso a {file_path}")
    return True

if __name__ == "__main__":
    # Caminho padrão do arquivo
    default_path = "Futebol-Virtual-Analytics/backend/analysis_routes.py"
    
    # Permitir passar o caminho como argumento
    file_path = sys.argv[1] if len(sys.argv) > 1 else default_path
    
    print("=" * 60)
    print("ADICIONAR ENDPOINT DE HEALTH CHECK")
    print("=" * 60)
    print()
    print(f"Arquivo: {file_path}")
    print()
    
    if add_health_check(file_path):
        print()
        print("=" * 60)
        print("✅ CONCLUÍDO COM SUCESSO!")
        print("=" * 60)
        print()
        print("Próximos passos:")
        print("1. Reinicie o servidor backend (Ctrl+C e depois uvicorn server:app --reload --port 8000)")
        print("2. Teste o endpoint: http://localhost:8000/analysis/health")
        print("3. Atualize o frontend para usar o indicador de status")
    else:
        print()
        print("=" * 60)
        print("❌ FALHA AO ADICIONAR O ENDPOINT")
        print("=" * 60)
        print()
        print("Você pode adicionar manualmente copiando o código do arquivo:")
        print("analysis_routes_com_health.py")

