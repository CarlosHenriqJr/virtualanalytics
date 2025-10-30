import pandas as pd
import numpy as np
from fastapi import APIRouter, Depends, HTTPException, Body
from fastapi.concurrency import run_in_threadpool
from database import get_db
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import logging

pattern_discovery_router = APIRouter(
    prefix="/pattern-discovery",
    tags=["Pattern Discovery"]
)
logger = logging.getLogger(__name__)

# --- Modelos Pydantic ---

class DiscoveryRequest(BaseModel):
    trigger_conditions: Dict[str, Any]  # Ex: {"placarHT": "0-0"}
    target_market: str                  # Ex: "TotalGols_MaisDe_25"
    max_skip: int = 20                   # Número máximo de pulos a testar
    entries_count: int = 1               # Tiros por entrada (ex: 1, 2, 3...)
    leagues: Optional[List[str]] = None  # Filtro de ligas (opcional)

class SkipResult(BaseModel):
    skip: int
    total_triggers: int
    total_entries_analyzed: int
    total_wins: int
    success_rate: float

# --- Lógica de Verificação de "Win" ---

def check_win_condition(game_data: Dict[str, Any], target_market: str) -> bool:
    """
    Verifica se uma entrada (jogo) foi um "win" com base no mercado alvo.
    Esta é a "engine de regras". ADICIONE MAIS REGRAS AQUI.
    """
    try:
        # Garante que campos numéricos existam, mesmo se nulos no DB
        casa_ft = game_data.get("placarCasaFT", 0) or 0
        fora_ft = game_data.get("placarForaFT", 0) or 0
        
        # Tenta extrair valores numéricos dos placares, caso não existam
        if "totalGolsFT" not in game_data or game_data.get("totalGolsFT") is None:
            game_data["totalGolsFT"] = casa_ft + fora_ft

        total_gols = game_data.get("totalGolsFT", 0) or 0

        if target_market.startswith("TotalGols_MaisDe_"):
            try:
                # Converte "25" para 2.5
                threshold = float(target_market.split('_')[-1].replace('5', '.5'))
                return total_gols > threshold
            except (ValueError, TypeError):
                return False
        
        elif target_market.startswith("TotalGols_MenosDe_"):
            try:
                threshold = float(target_market.split('_')[-1].replace('5', '.5'))
                return total_gols < threshold
            except (ValueError, TypeError):
                return False

        elif target_market == "ParaOTimeMarcarSimNao_AmbasMarcam":
            # "Ambas Marcam"
            return casa_ft > 0 and fora_ft > 0
            
        elif target_market == "ParaOTimeMarcarSimNao_AmbasNaoMarcam":
            # "Ambas Não Marcam"
            return casa_ft == 0 or fora_ft == 0

        elif target_market == "VencedorFT_Casa":
            return casa_ft > fora_ft
            
        elif target_market == "VencedorFT_Visitante":
            return casa_ft < fora_ft

        elif target_market == "VencedorFT_Empate":
            return casa_ft == fora_ft

        # Adicione mais regras conforme necessário...
        elif target_market.startswith("ResultadoCorreto_"):
            placar_ft_str = game_data.get("placarFT", "") # Ex: "4-0"
            if target_market == "ResultadoCorreto_Casa_1x0":
                return placar_ft_str == "1-0"
            if target_market == "ResultadoCorreto_Empate_0x0":
                return placar_ft_str == "0-0"
            # ... etc ...

        else:
            # Mercado não implementado na engine de regras
            return False
            
    except Exception:
        # Erro na lógica de verificação
        return False
    return False

# --- Lógica de Descoberta (Heavy Lifting) ---

def run_discovery_analysis(
    all_games: List[Dict[str, Any]], 
    trigger_conditions: Dict[str, Any], 
    target_market: str, 
    max_skip: int, 
    entries_count: int
) -> List[Dict]:
    
    logger.info(f"Iniciando descoberta: {target_market} após {trigger_conditions} (Max Skip: {max_skip}, Tiros: {entries_count})")
    
    # 1. Encontrar todos os gatilhos
    trigger_game_indices = []
    for idx, game in enumerate(all_games):
        # Checagem manual das condições do gatilho
        match = True
        for key, value in trigger_conditions.items():
            if game.get(key) != value:
                match = False
                break
        if match:
            trigger_game_indices.append(idx)
    
    total_triggers_found = len(trigger_game_indices)
    if total_triggers_found == 0:
        logger.warning("Nenhum gatilho encontrado.")
        return []

    logger.info(f"Total de gatilhos encontrados: {total_triggers_found}")

    final_results = []
    
    # 2. Iterar por CADA pulo (de 0 até max_skip)
    for skip in range(max_skip + 1):
        total_wins = 0
        total_entries_analyzed = 0
        valid_triggers_for_this_skip = 0 # Contar gatilhos que têm entradas suficientes

        # 3. Para cada gatilho, encontrar suas N entradas
        for trigger_idx in trigger_game_indices:
            
            entry_found = False # Flag para saber se este gatilho gerou uma entrada
            
            # 4. Encontrar os N jogos de entrada (tiros)
            for entry_index in range(entries_count):
                game_to_check_idx = trigger_idx + skip + 1 + entry_index
                
                if game_to_check_idx >= len(all_games):
                    # Se o primeiro tiro (entry_index=0) já está fora dos limites, 
                    # este gatilho não é válido para este 'skip'.
                    if entry_index == 0:
                        entry_found = False
                    break # Chegamos ao fim da lista de jogos
                
                # Se chegamos aqui, pelo menos o primeiro tiro é válido
                if entry_index == 0:
                    entry_found = True

                entry_game = all_games[game_to_check_idx]
                total_entries_analyzed += 1
                
                # 5. Verificar se foi "win"
                if check_win_condition(entry_game, target_market):
                    total_wins += 1
                    # Se for multi-tiro, para no primeiro acerto
                    break 
            
            if entry_found:
                valid_triggers_for_this_skip += 1

        # 6. Calcular estatísticas para este 'skip'
        # A taxa de sucesso é (acertos / gatilhos válidos)
        success_rate = (total_wins / valid_triggers_for_this_skip) if valid_triggers_for_this_skip > 0 else 0
        
        final_results.append({
            "skip": skip,
            "total_triggers": valid_triggers_for_this_skip, # Mostra quantos gatilhos foram realmente usados
            "total_entries_analyzed": total_entries_analyzed, 
            "total_wins": total_wins,
            "success_rate": success_rate
        })
        
    logger.info(f"Análise de {max_skip+1} pulos concluída.")
    return final_results

# --- Endpoint ---

@pattern_discovery_router.post("/find-best-skip", response_model=List[SkipResult])
async def find_best_skip_pattern(
    request: DiscoveryRequest = Body(...),
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """
    Executa uma análise exploratória para descobrir o melhor "pulo" (skip)
    para um gatilho e um mercado-alvo específicos.
    Testa todos os pulos de 0 até max_skip.
    """
    
    # 1. Definir ordenação
    sort_order = [("date", 1), ("hour", 1), ("minute", 1)]
    
    # 2. Definir filtros (ex: ligas)
    query_filter = {}
    if request.leagues and len(request.leagues) > 0:
        query_filter["league"] = {"$in": request.leagues}

    # 3. Buscar TODOS os jogos (operação pesada)
    # Projetamos apenas os campos estritamente necessários
    projection = {
        "_id": 1, "date": 1, "hour": 1, "minute": 1, "league": 1,
        "placarHT": 1, "placarFT": 1, "placarCasaHT": 1, "placarForaHT": 1, 
        "placarCasaFT": 1, "placarForaFT": 1, "totalGolsFT": 1
    }
    
    # Adiciona campos de gatilho e mercado-alvo na projeção
    for key in request.trigger_conditions.keys():
        projection[key] = 1
    
    try:
        all_games_cursor = db.partidas.find(query_filter, projection).sort(sort_order)
        all_games = await all_games_cursor.to_list(length=None)
    except Exception as e:
        logger.error(f"Erro ao buscar todos os jogos: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Erro ao carregar dados históricos.")

    if not all_games:
        raise HTTPException(status_code=404, detail="Nenhum jogo encontrado no banco de dados para os filtros aplicados.")

    # 4. Executar a análise pesada em um threadpool
    results = await run_in_threadpool(
        run_discovery_analysis,
        all_games=all_games,
        trigger_conditions=request.trigger_conditions,
        target_market=request.target_market,
        max_skip=request.max_skip,
        entries_count=request.entries_count
    )

    if not results:
         raise HTTPException(status_code=404, detail="Nenhum gatilho encontrado para as condições especificadas. Verifique sua query JSON (ex: placar '0-0' e não '0x0').")

    return results