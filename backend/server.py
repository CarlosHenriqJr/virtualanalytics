"""
Servidor FastAPI principal para análise de dados de futebol virtual.
"""

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import Any
import logging
from database import connect_to_mongo, close_mongo_connection, get_db


# Importar todos os routers
from analysis_routes import analysis_router
from advanced_sequential_analysis import advanced_analysis_router
from pattern_discovery_ml import pattern_discovery_router
from efficient_pattern_analysis import efficient_pattern_router
from adaptive_pattern_learning import adaptive_learning_router
<<<<<<< HEAD
from deep_pattern_analysis import deep_pattern_router
from over35_complete_analysis import over35_router

=======
from advanced_analysis import advanced_analysis_router as full_advanced_analysis_router
from deep_pattern_analysis import deep_pattern_router
>>>>>>> 2f592652b50a0514f6e87fc5b7d4e02582d6d746

# Configuração de logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger("futebol-analysis")

# Criar aplicação FastAPI
app = FastAPI(
    title="Futebol Virtual Analysis API",
    description="API para análise de dados de futebol virtual e identificação de gatilhos",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# ==================== CORS ====================
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8000",  # Para testes diretos
        "*"  # ⚠️ Remover em produção
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==================== ROTAS ====================
app.include_router(analysis_router)
app.include_router(advanced_analysis_router)
app.include_router(pattern_discovery_router)
app.include_router(efficient_pattern_router)
app.include_router(adaptive_learning_router)
<<<<<<< HEAD
app.include_router(deep_pattern_router)
app.include_router(over35_router)
=======
app.include_router(full_advanced_analysis_router)
app.include_router(deep_pattern_router)
>>>>>>> 2f592652b50a0514f6e87fc5b7d4e02582d6d746


# ==================== EVENTOS ====================
@app.on_event("startup")
async def startup_event():
    logger.info("🚀 Iniciando Futebol Analysis API v2.0")
    try:
        await connect_to_mongo()
        logger.info("✅ Conexão com MongoDB estabelecida")
        logger.info("📊 Routers registrados:")
        routers_info = [
            ("/analysis", "Análise básica"),
            ("/advanced-analysis", "Análise sequencial avançada"),
            ("/pattern-discovery", "Descoberta de padrões com ML"),
            ("/efficient-pattern", "Análise eficiente de padrões"),
            ("/adaptive-learning", "Aprendizado adaptativo"),
            ("/deep-pattern", "Análise profunda de padrões"),
            ("/over35-analysis", "Análise completa Over 3.5 ⚽")
        ]
        for path, desc in routers_info:
            logger.info(f"   • {path} → {desc}")
    except Exception as e:
        logger.error(f"❌ Falha na inicialização: {e}")
        raise

@app.on_event("shutdown")
async def shutdown_event():
    logger.info("🛑 Encerrando conexão com MongoDB...")
    await close_mongo_connection()

# ==================== ROTAS DE UTILIDADE ====================
@app.get("/")
async def root():
    return {
        "api": "Futebol Virtual Analysis API",
        "version": "2.0.0",
        "docs": "/docs",
        "debug_routes": "/debug/routes",
        "health": "/health"
    }

@app.get("/health")
async def health_check(db: Any = Depends(get_db)):
    try:
        await db.command("ping")
        total = await db.partidas.count_documents({})
        return {"status": "healthy", "database": "connected", "total_matches": total}
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Database error: {str(e)}")

@app.get("/debug/routes")
def debug_routes():
    """Lista todas as rotas registradas (use para diagnosticar 404)."""
    routes = []
    for route in app.routes:
        if hasattr(route, 'path'):
            routes.append({
                "path": route.path,
                "name": getattr(route, 'name', 'N/A'),
                "methods": list(getattr(route, 'methods', []))
            })
    return {"total": len(routes), "routes": sorted(routes, key=lambda x: x["path"])}

# ==================== EXECUÇÃO ====================
if __name__ == "__main__":
    import uvicorn
    logger.info("🚀 Servidor rodando em http://0.0.0.0:8000")
    logger.info("📚 Documentação: http://localhost:8000/docs")
    logger.info("🔍 Debug de rotas: http://localhost:8000/debug/routes")
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)