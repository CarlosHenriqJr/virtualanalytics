# ============================================================================
# CONFIGURAÇÃO DE CONEXÃO COM O MONGODB (ASYNC)
# ============================================================================

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from dotenv import load_dotenv
from typing import Any, Optional
import os
import logging
import asyncio

# ----------------------------------------------------------------------------
# CARREGA VARIÁVEIS DO .env
# ----------------------------------------------------------------------------
load_dotenv()

MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "futebol")

# ----------------------------------------------------------------------------
# LOGGING
# ----------------------------------------------------------------------------
logger = logging.getLogger("database")
logger.setLevel(logging.INFO)
handler = logging.StreamHandler()
formatter = logging.Formatter("[%(asctime)s] [%(levelname)s] %(message)s")
handler.setFormatter(formatter)
logger.addHandler(handler)

# ----------------------------------------------------------------------------
# CLIENTE GLOBAL E BANCO DE DADOS
# ----------------------------------------------------------------------------
_client: Optional[AsyncIOMotorClient] = None
_database: Optional[AsyncIOMotorDatabase] = None


# ----------------------------------------------------------------------------
# FUNÇÃO DE CONEXÃO
# ----------------------------------------------------------------------------
async def connect_to_mongo() -> AsyncIOMotorDatabase:
    """Cria a conexão global com o MongoDB."""
    global _client, _database

    if _client:
        logger.info("Conexão com MongoDB já existente.")
        return _database  # type: ignore

    try:
        _client = AsyncIOMotorClient(MONGO_URL, serverSelectionTimeoutMS=5000)
        # Testa a conexão
        await _client.admin.command("ping")
        _database = _client[MONGO_DB_NAME]
        logger.info(f"✅ Conectado ao MongoDB: {MONGO_URL} (DB: {MONGO_DB_NAME})")
        return _database
    except Exception as e:
        logger.error(f"❌ Erro ao conectar ao MongoDB: {e}")
        raise e


# ----------------------------------------------------------------------------
# FUNÇÃO PARA OBTER O BANCO DE DADOS
# ----------------------------------------------------------------------------
async def get_database() -> AsyncIOMotorDatabase:
    """
    Retorna uma instância ativa do banco de dados MongoDB.
    Cria uma nova conexão se necessário.
    """
    global _database
    if _database is None:
        await connect_to_mongo()
    return _database  # type: ignore


# ----------------------------------------------------------------------------
# FUNÇÃO PARA FECHAR A CONEXÃO (opcional)
# ----------------------------------------------------------------------------
async def close_mongo_connection() -> None:
    """Fecha a conexão global com o MongoDB."""
    global _client
    if _client:
        _client.close()
        logger.info("🔌 Conexão com MongoDB encerrada.")
        _client = None


# ----------------------------------------------------------------------------
# DEPENDENCY INJECTION PARA FASTAPI
# ----------------------------------------------------------------------------
async def get_db() -> AsyncIOMotorDatabase:
    """Dependency para FastAPI routes."""
    return await get_database()


# ----------------------------------------------------------------------------
# EXECUÇÃO OPCIONAL (TESTE MANUAL)
# ----------------------------------------------------------------------------
if __name__ == "__main__":
    async def test_connection():
        db = await connect_to_mongo()
        collections = await db.list_collection_names()
        print(f"📦 Coleções disponíveis: {collections}")
        
        # Teste de contagem de documentos
        if "matches" in collections:
            count = await db.matches.count_documents({})
            print(f"📊 Total de jogos na coleção 'matches': {count}")

    asyncio.run(test_connection())