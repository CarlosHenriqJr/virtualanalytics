"""
Servidor FastAPI principal para análise de dados de futebol virtual.
"""

from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from typing import Any
import logging
from database import connect_to_mongo, close_mongo_connection, get_db
from analysis_routes import analysis_router
from advanced_sequential_analysis import advanced_analysis_router

# Configuração de logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler()
    ]
)

logger = logging.getLogger("futebol-analysis")

# Criar aplicação FastAPI
app = FastAPI(
    title="Futebol Virtual Analysis API",
    description="API para análise de dados de futebol virtual e identificação de gatilhos",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# ==================== CONFIGURAR CORS (APENAS UMA VEZ!) ====================
# ✅ CORRIGIDO: Removida duplicação e adicionadas múltiplas origens
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",      # React Dev
        "http://127.0.0.1:3000",      # React Dev (alternativo)
        "http://localhost:5173",      # Vite Dev
        "http://127.0.0.1:5173",      # Vite Dev (alternativo)
        "*"                            # ⚠️ Remova em produção!
    ],
    allow_credentials=True,
    allow_methods=["*"],               # Permite GET, POST, PUT, DELETE, etc
    allow_headers=["*"],               # Permite todos os headers
)

# ==================== INCLUIR ROUTERS ====================
# ✅ Routers devem vir DEPOIS da configuração CORS
app.include_router(analysis_router)
app.include_router(advanced_analysis_router)

# Eventos de startup/shutdown
@app.on_event("startup")
async def startup_event():
    """Conecta ao MongoDB quando a aplicação inicia."""
    logger.info("🚀 Iniciando Futebol Analysis API")
    try:
        await connect_to_mongo()
        logger.info("✅ Aplicação inicializada com sucesso")
    except Exception as e:
        logger.error(f"❌ Erro na inicialização: {e}")

@app.on_event("shutdown")
async def shutdown_event():
    """Fecha a conexão com o MongoDB."""
    logger.info("🛑 Encerrando Futebol Analysis API")
    await close_mongo_connection()

# Rota raiz
@app.get("/")
async def root():
    """Rota raiz com informações da API."""
    return {
        "message": "Futebol Virtual Analysis API",
        "version": "1.0.0",
        "docs": "/docs",
        "health_check": "/analysis/health"
    }

@app.get("/info")
async def api_info(db: Any = Depends(get_db)):
    """Informações gerais sobre a API."""
    try:
        matches_count = await db.matches.count_documents({})
        return {
            "api": "Futebol Virtual Analysis",
            "version": "1.0.0",
            "database_status": "connected",
            "total_matches": matches_count,
            "endpoints": {
                "analysis": "/analysis",
                "advanced_analysis": "/advanced-analysis",
                "health": "/analysis/health",
                "docs": "/docs"
            }
        }
    except Exception as e:
        return {
            "api": "Futebol Virtual Analysis",
            "version": "1.0.0",
            "database_status": "error",
            "error": str(e)
        }


@app.get("/debug/routes")
def debug_routes():
    """Lista todas as rotas registradas na API."""
    route_list = []
    for route in app.routes:
        if hasattr(route, 'path'):
            methods = getattr(route, 'methods', [])
            route_list.append({
                "path": route.path,
                "name": getattr(route, 'name', 'N/A'),
                "methods": list(methods) if methods else []
            })
    return route_list


# Para executar diretamente
if __name__ == "__main__":
    import uvicorn
    logger.info("🚀 Iniciando servidor em http://0.0.0.0:8000")
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)