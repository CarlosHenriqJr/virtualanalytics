# ingest_data.py
import gzip
import json
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from pathlib import Path
from dotenv import load_dotenv

# Carrega as variáveis de ambiente do .env na raiz do projeto
load_dotenv()

async def ingest_matches():
    """Ingere dados de jogos no MongoDB."""
    mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017/")
    db_name = os.environ.get("DB_NAME", "futebol_virtual_db")
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    # Encontrar todos os arquivos .json.gz no diretório atual
    data_files = sorted(Path(".").glob("matches_part*.json.gz"))
    
    if not data_files:
        print("Nenhum arquivo 'matches_part*.json.gz' encontrado para ingestão.")
        print("Certifique-se de ter executado o script de divisão e compressão.")
        client.close()
        return

    print(f"Iniciando ingestão de {len(data_files)} arquivos...")

    for file_path in data_files:
        print(f"Processando {file_path}...")
        
        # Descompactar e ler
        with gzip.open(file_path, 'rt', encoding='utf-8') as f:
            matches = json.load(f)
        
        # Inserir no MongoDB
        if matches:
            # Adiciona um campo de data para indexação e filtragem no backend
            for match in matches:
                if "date" not in match:
                    match["date"] = match["id"].split('_')[-2] # Extrai a data do ID se não existir

            # Remover _id se existir para evitar conflitos ao inserir
            for match in matches:
                match.pop("_id", None)

            try:
                result = await db.matches.insert_many(matches)
                print(f"  Inseridos {len(result.inserted_ids)} documentos de {file_path.name}")
            except Exception as e:
                print(f"  Erro ao inserir documentos de {file_path.name}: {e}")
        else:
            print(f"  Arquivo {file_path.name} vazio, ignorando.")
    
    # Criar índices (garante que existam)
    await db.matches.create_index("date")
    await db.matches.create_index("id")
    await db.matches.create_index([("date", 1), ("markets", 1)])
    
    client.close()
    print("✅ Ingestão de dados concluída!")

if __name__ == "__main__":
    asyncio.run(ingest_matches())
