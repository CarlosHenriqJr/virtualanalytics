"""
ai_insights_routes.py - VERSÃO FINAL DEFINITIVA

Detecta arquitetura COMPLETA do checkpoint e cria rede compatível.
"""

from fastapi import APIRouter, Depends, HTTPException
from typing import Dict, Any
import logging
import os
import torch
import torch.nn as nn
from database import get_db
from datetime import datetime

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai/insights", tags=["AI Insights"])

_analyzer_cache = None
_last_model_path = None


def detect_checkpoint_format(checkpoint):
    """Detecta formato do checkpoint"""
    
    if isinstance(checkpoint, dict) and 'policy_net_state_dict' in checkpoint:
        logger.info("📦 Formato: Checkpoint com policy_net_state_dict")
        return (checkpoint['policy_net_state_dict'], checkpoint.get('config', {}), 'policy_net')
    
    if isinstance(checkpoint, dict) and 'model_state_dict' in checkpoint:
        logger.info("📦 Formato: Checkpoint com model_state_dict")
        return (checkpoint['model_state_dict'], checkpoint.get('config', {}), 'model_state_dict')
    
    if isinstance(checkpoint, dict) and 'state_dict' in checkpoint:
        logger.info("📦 Formato: Checkpoint com state_dict")
        return (checkpoint['state_dict'], checkpoint.get('config', {}), 'state_dict')
    
    if isinstance(checkpoint, dict) and any('weight' in k for k in checkpoint.keys()):
        logger.info("📦 Formato: State dict direto")
        return (checkpoint, {}, 'direct')
    
    raise ValueError("Formato de checkpoint desconhecido")


def infer_complete_architecture(state_dict):
    """
    Infere arquitetura COMPLETA incluindo todas as camadas.
    
    Returns:
        (input_size, hidden_sizes_list, output_size)
    """
    
    # Coletar todas as camadas Linear
    layers = []
    for key in sorted(state_dict.keys()):
        if 'weight' in key and len(state_dict[key].shape) == 2:
            layers.append({
                'name': key,
                'out': state_dict[key].shape[0],
                'in': state_dict[key].shape[1]
            })
    
    if not layers:
        raise ValueError("Nenhuma camada encontrada")
    
    logger.info(f"🔍 Estrutura completa:")
    for i, layer in enumerate(layers):
        logger.info(f"   {i+1}. {layer['name']:30s} [{layer['out']}, {layer['in']}]")
    
    input_size = layers[0]['in']
    hidden_sizes = [layer['out'] for layer in layers[:-1]]
    output_size = layers[-1]['out']
    
    arch_str = f"{input_size} -> " + " -> ".join(map(str, hidden_sizes)) + f" -> {output_size}"
    logger.info(f"📏 Arquitetura: {arch_str}")
    
    return input_size, hidden_sizes, output_size


def create_compatible_network(input_size, hidden_sizes, output_size):
    """Cria rede Sequential compatível com o checkpoint"""
    
    class CompatibleQNetwork(nn.Module):
        def __init__(self, input_size, hidden_sizes, output_size):
            super().__init__()
            
            layers = []
            prev_size = input_size
            
            for hidden_size in hidden_sizes:
                layers.append(nn.Linear(prev_size, hidden_size))
                layers.append(nn.ReLU())
                prev_size = hidden_size
            
            layers.append(nn.Linear(prev_size, output_size))
            
            self.network = nn.Sequential(*layers)
        
        def forward(self, x):
            return self.network(x)
    
    return CompatibleQNetwork(input_size, hidden_sizes, output_size)


async def get_analyzer():
    """Retorna analyzer"""
    global _analyzer_cache, _last_model_path
    
    from ai_system.ai_betting_system import BettingAgent, AIConfig
    from ai_system.ai_insights_analyzer import AIInsightsAnalyzer
    
    # Procurar modelo
    model_dir = "models"
    if not os.path.exists(model_dir):
        raise HTTPException(404, "Pasta models/ não encontrada")
    
    model_files = [f for f in os.listdir(model_dir) if f.endswith(('.pt', '.pth'))]
    if not model_files:
        raise HTTPException(404, "Nenhum modelo encontrado")
    
    # Escolher modelo
    if 'betting_ai_final.pt' in model_files:
        model_path = os.path.join(model_dir, 'betting_ai_final.pt')
    elif 'best_model.pt' in model_files:
        model_path = os.path.join(model_dir, 'best_model.pt')
    elif 'best_model.pth' in model_files:
        model_path = os.path.join(model_dir, 'best_model.pth')
    else:
        model_path = os.path.join(model_dir, max(model_files, key=lambda f: os.path.getmtime(os.path.join(model_dir, f))))
    
    # Se mudou, recarregar
    if _analyzer_cache is None or _last_model_path != model_path:
        logger.info(f"📊 Carregando: {model_path}")
        
        try:
            # Carregar checkpoint
            checkpoint = torch.load(model_path, weights_only=False)
            logger.info("📦 Checkpoint carregado")
            
            # Detectar formato
            state_dict, config_dict, format_name = detect_checkpoint_format(checkpoint)
            logger.info(f"✅ Formato: {format_name}")
            
            # Inferir arquitetura COMPLETA
            input_size, hidden_sizes, output_size = infer_complete_architecture(state_dict)
            
            # Criar config
            config = AIConfig()
            config.input_size = input_size
            config.hidden_size = hidden_sizes[0] if hidden_sizes else 128
            config.output_size = output_size
            
            # Usar config do checkpoint se disponível
            if config_dict:
                if isinstance(config_dict, dict):
                    for key, value in config_dict.items():
                        if hasattr(config, key):
                            setattr(config, key, value)
                else:
                    # É objeto
                    for key in dir(config_dict):
                        if not key.startswith('_') and hasattr(config, key):
                            value = getattr(config_dict, key)
                            if not callable(value):
                                setattr(config, key, value)
            
            # Criar agente
            agent = BettingAgent(config)
            
            # SEMPRE criar rede que aceita o checkpoint diretamente
            logger.info("🔧 Criando rede compatível com checkpoint...")
            
            import torch.nn as nn
            
            class DirectLoadQNetwork(nn.Module):
                """Rede que carrega state_dict diretamente"""
                def __init__(self, state_dict):
                    super().__init__()
                    
                    # Criar Sequential vazio
                    self.network = nn.Sequential()
                    
                    # Adicionar todas as camadas do state_dict
                    # Inferir tipo baseado nas chaves
                    layer_idx = 0
                    processed_indices = set()
                    
                    # Ordenar chaves por índice
                    all_keys = sorted([k for k in state_dict.keys()], 
                                    key=lambda x: int(x.split('.')[1]) if len(x.split('.')) > 1 and x.split('.')[1].isdigit() else 999)
                    
                    for key in all_keys:
                        if 'network.' not in key:
                            continue
                        
                        parts = key.split('.')
                        if len(parts) < 3:
                            continue
                        
                        idx = int(parts[1])
                        
                        if idx in processed_indices:
                            continue
                        
                        param_name = parts[2]
                        
                        if param_name == 'weight':
                            weight = state_dict[key]
                            
                            if len(weight.shape) == 2:
                                # Linear layer
                                out_features, in_features = weight.shape
                                layer = nn.Linear(in_features, out_features)
                                
                                # Carregar weight e bias se existir
                                layer.weight.data = weight.clone()
                                bias_key = f'network.{idx}.bias'
                                if bias_key in state_dict:
                                    layer.bias.data = state_dict[bias_key].clone()
                                
                                self.network.add_module(str(layer_idx), layer)
                                layer_idx += 1
                                processed_indices.add(idx)
                                
                                # Adicionar ReLU após (exceto última camada)
                                # Verificar se há próxima camada Linear
                                next_linear_idx = None
                                for future_key in all_keys:
                                    if 'network.' in future_key and '.weight' in future_key:
                                        future_idx = int(future_key.split('.')[1])
                                        if future_idx > idx:
                                            next_linear_idx = future_idx
                                            break
                                
                                if next_linear_idx is not None:
                                    self.network.add_module(str(layer_idx), nn.ReLU())
                                    layer_idx += 1
                            
                            elif len(weight.shape) == 1:
                                # BatchNorm or other
                                pass
                
                def forward(self, x):
                    return self.network(x)
            
            # Criar rede
            agent.q_network = DirectLoadQNetwork(state_dict)
            agent.q_network = agent.q_network.to(agent.device if hasattr(agent, 'device') else 'cpu')
            
            logger.info(f"✅ Rede criada com {len(agent.q_network.network)} módulos")
            
            # Não precisa carregar pesos (já foram carregados na criação)
            agent.q_network.eval()
            logger.info("✅ Rede pronta para uso!")
            
        except Exception as e:
            logger.error(f"❌ Erro: {e}")
            import traceback
            logger.error(traceback.format_exc())
            raise HTTPException(500, f"Erro ao carregar: {str(e)}")
        
        # Buscar dados
        try:
            db = await get_db()
            cursor = db.partidas.find().sort("_id", -1).limit(1000)
            matches = await cursor.to_list(length=1000)
            logger.info(f"📈 {len(matches)} partidas")
        except Exception as e:
            raise HTTPException(500, f"Erro ao buscar dados: {str(e)}")
        
        if not matches:
            raise HTTPException(404, "Nenhuma partida no banco")
        
        # Criar analyzer
        _analyzer_cache = AIInsightsAnalyzer(agent, matches)
        _last_model_path = model_path
        
        logger.info("✅ Analyzer pronto!")
    
    return _analyzer_cache


@router.get("/")
async def get_all_insights(analyzer=Depends(get_analyzer)) -> Dict:
    """Todos os insights"""
    try:
        insights = analyzer.analyze_all()
        return {"status": "success", "insights": insights, "timestamp": datetime.now().isoformat()}
    except Exception as e:
        raise HTTPException(500, str(e))


@router.get("/best-gatilho")
async def get_best_gatilho(analyzer=Depends(get_analyzer)) -> Dict:
    """Melhor gatilho"""
    try:
        logger.info("🎯 Extraindo gatilho...")
        insights = analyzer.analyze_all()
        entry = insights["best_entry_conditions"]
        
        if "optimal_conditions" not in entry:
            raise HTTPException(404, "Dados insuficientes")
        
        opt = entry["optimal_conditions"]
        action_names = {1: "BAIXO", 2: "MÉDIO", 3: "ALTO"}
        
        gatilho = {
            "odd_ideal": float(opt["odd_over35_range"]["ideal"]),
            "odd_min": float(opt["odd_over35_range"]["min"]),
            "odd_max": float(opt["odd_over35_range"]["max"]),
            "ratio_ideal": float(opt["ratio_over_under_range"]["ideal"]),
            "ratio_min": float(opt["ratio_over_under_range"]["min"]),
            "ratio_max": float(opt["ratio_over_under_range"]["max"]),
            "melhores_horarios": opt["best_hours"],
            "stake_preferido": action_names.get(opt["preferred_action"], "MÉDIO"),
            "win_rate_esperado": float(entry["win_rate"])
        }
        
        logger.info(f"✅ Gatilho: odd={gatilho['odd_ideal']:.2f}, wr={gatilho['win_rate_esperado']:.1f}%")
        
        return {
            "status": "success",
            "gatilho": gatilho,
            "regras": entry.get("rules_summary", []),
            "estatisticas": {
                "total_entradas_analisadas": entry["total_entries"],
                "greens": entry["greens"],
                "reds": entry["reds"],
                "win_rate": entry["win_rate"]
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Erro: {e}")
        raise HTTPException(500, str(e))


@router.get("/rules")
async def get_extracted_rules(analyzer=Depends(get_analyzer)) -> Dict:
    """Regras"""
    try:
        insights = analyzer.analyze_all()
        return {"status": "success", "rules": insights["extracted_rules"], "total_rules": len(insights["extracted_rules"])}
    except Exception as e:
        raise HTTPException(500, str(e))


@router.get("/report")
async def get_text_report(analyzer=Depends(get_analyzer)) -> Dict:
    """Relatório"""
    try:
        report = analyzer.generate_report()
        return {"status": "success", "report": report, "timestamp": datetime.now().isoformat()}
    except Exception as e:
        raise HTTPException(500, str(e))


@router.get("/feature-importance")
async def get_feature_importance_detailed(analyzer=Depends(get_analyzer)) -> Dict:
    """Feature importance"""
    try:
        insights = analyzer.analyze_all()
        feat = insights["feature_importance"]
        return {"status": "success", "top_10": feat["top_10"], "interpretation": feat["interpretation"]}
    except Exception as e:
        raise HTTPException(500, str(e))


@router.get("/odds-sweet-spot")
async def get_odds_sweet_spot(analyzer=Depends(get_analyzer)) -> Dict:
    """Sweet spot"""
    try:
        insights = analyzer.analyze_all()
        return {"status": "success", "sweet_spot": insights["odds_patterns"]["sweet_spot"]}
    except Exception as e:
        raise HTTPException(500, str(e))


@router.get("/temporal-analysis")
async def get_temporal_analysis(analyzer=Depends(get_analyzer)) -> Dict:
    """Análise temporal"""
    try:
        insights = analyzer.analyze_all()
        return {"status": "success", "temporal_analysis": insights["temporal_insights"]}
    except Exception as e:
        raise HTTPException(500, str(e))


@router.get("/status")
async def insights_status() -> Dict:
    """Status"""
    model_dir = "models"
    if not os.path.exists(model_dir):
        return {"available": False, "message": "Pasta models/ não encontrada", "models_found": 0}
    
    model_files = [f for f in os.listdir(model_dir) if f.endswith(('.pt', '.pth'))]
    return {
        "available": len(model_files) > 0,
        "message": "OK" if model_files else "Nenhum modelo",
        "models_found": len(model_files),
        "model_list": model_files[:5]
    }


@router.post("/clear-cache")
async def clear_cache() -> Dict:
    """Limpa cache"""
    global _analyzer_cache, _last_model_path
    _analyzer_cache = None
    _last_model_path = None
    return {"status": "success", "message": "Cache limpo"}