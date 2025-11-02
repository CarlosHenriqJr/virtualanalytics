"""
ai_training_engine.py - Engine de Treinamento + API FastAPI

Funcionalidades:
1. Training loop completo
2. Backtesting
3. Avaliação de performance
4. API para controle via frontend
5. WebSocket para updates em tempo real
"""

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Optional
import asyncio
import json
from datetime import datetime
import numpy as np
import torch

# Import relativo para quando usado como pacote
try:
    from .ai_betting_system import BettingAgent, AIConfig, FeatureExtractor
except ImportError:
    # Import absoluto para quando usado diretamente
    from ai_betting_system import BettingAgent, AIConfig, FeatureExtractor

# ==================== MODELOS DA API ====================

class TrainingRequest(BaseModel):
    """Requisição para iniciar treinamento"""
    num_episodes: int = 100
    data_start_date: str
    data_end_date: str
    save_interval: int = 50

class EvaluationRequest(BaseModel):
    """Requisição para avaliar modelo"""
    model_path: str
    test_data_start: str
    test_data_end: str

class PredictionRequest(BaseModel):
    """Requisição para predição em tempo real"""
    match_data: Dict
    model_path: Optional[str] = None

# ==================== TRAINING ENGINE ====================

class TrainingEngine:
    """Engine de treinamento da IA"""
    
    def __init__(self, db_connection):
        self.db = db_connection
        self.agent = None
        self.is_training = False
        self.is_paused = False
        self.current_episode = 0
        self.websocket_clients = []
    
    async def load_matches(self, start_date: str, end_date: str) -> List[Dict]:
        """Carrega partidas do banco de dados"""
        
        matches = await self.db.partidas.find({
            "date": {
                "$gte": start_date,
                "$lte": end_date
            }
        }).sort([("date", 1), ("hour", 1)]).to_list(None)
        
        print(f"📊 Carregadas {len(matches)} partidas ({start_date} a {end_date})")
        
        return matches
    
    def check_over35(self, match_data: Dict) -> bool:
        """Verifica se a partida foi over 3.5 gols"""
        
        # IMPORTANTE: Isso só funciona se você tem o resultado
        # Em produção, isso viria do resultado real da partida
        total_gols = match_data.get("totalGolsFT", 0)
        return total_gols > 3.5
    
    async def train(
        self, 
        num_episodes: int,
        start_date: str,
        end_date: str,
        save_interval: int = 50
    ):
        """
        Treina a IA em dados históricos.
        
        Args:
            num_episodes: Número de episódios (passes completos nos dados)
            start_date: Data inicial
            end_date: Data final
            save_interval: Salvar modelo a cada N episódios
        """
        
        self.is_training = True
        
        # Criar agente se não existe
        if self.agent is None:
            config = AIConfig()
            self.agent = BettingAgent(config)
        
        # Carregar dados
        matches = await self.load_matches(start_date, end_date)
        
        if len(matches) == 0:
            raise ValueError("Nenhuma partida encontrada no período")
        
        print(f"\n{'='*60}")
        print(f"🚀 INICIANDO TREINAMENTO")
        print(f"{'='*60}")
        print(f"📅 Período: {start_date} a {end_date}")
        print(f"🎮 Episódios: {num_episodes}")
        print(f"🎯 Partidas por episódio: {len(matches)}")
        print(f"💰 Bankroll inicial: ${self.agent.config.initial_bankroll}")
        print(f"{'='*60}\n")
        
        # Loop de treinamento
        for episode in range(num_episodes):
            if not self.is_training:
                break
            
            # Pausar se necessário
            while self.is_paused:
                await asyncio.sleep(0.5)
            
            self.current_episode = episode
            
            # Reset bankroll para cada episódio
            self.agent.bankroll = self.agent.config.initial_bankroll
            self.agent.history = []
            
            episode_reward = 0
            episode_greens = 0
            episode_reds = 0
            episode_skips = 0
            episode_losses = []
            
            # Loop pelas partidas
            for i, match in enumerate(matches):
                # Extrair features
                state = self.agent.feature_extractor.extract(match, self.agent.history)
                
                # Selecionar ação
                action = self.agent.select_action(state, training=True)
                
                # Verificar resultado real da partida
                match_result = self.check_over35(match)
                
                # Calcular recompensa
                odd = match.get("markets", {}).get("TotalGols_MaisDe_35", 2.0)
                reward = self.agent.calculate_reward(action, match_result, odd)
                
                episode_reward += reward
                
                # Estatísticas
                if action in [0, 1]:  # Entrou
                    if match_result:
                        episode_greens += 1
                    else:
                        episode_reds += 1
                else:
                    episode_skips += 1
                
                # Próximo estado
                is_last = (i == len(matches) - 1)
                
                if not is_last:
                    next_match = matches[i + 1]
                    next_state = self.agent.feature_extractor.extract(next_match, self.agent.history)
                else:
                    next_state = state  # Último jogo
                
                # Armazenar experiência
                self.agent.store_experience(state, action, reward, next_state, is_last)
                
                # Treinar
                loss = self.agent.train_step()
                if loss is not None:
                    episode_losses.append(loss)
                
                # Atualizar target network
                if self.agent.steps_done % self.agent.config.target_update_freq == 0:
                    self.agent.update_target_network()
                
                self.agent.steps_done += 1
                
                # Atualizar histórico
                self.agent.history.append({
                    "result": 1 if (action in [0, 1] and match_result) else 0,
                    "bankroll": self.agent.bankroll
                })
                
                # Stop em caso de drawdown extremo
                if self.agent.bankroll < self.agent.config.initial_bankroll * (1 - self.agent.config.max_drawdown_stop):
                    print(f"⚠️  Drawdown limite atingido! Parando episódio.")
                    break
                
                # Update via WebSocket (a cada 10 jogos)
                if i % 10 == 0:
                    await self.broadcast_training_update({
                        "episode": episode,
                        "total_episodes": num_episodes,
                        "match": i,
                        "total_matches": len(matches),
                        "bankroll": self.agent.bankroll,
                        "epsilon": self.agent.epsilon,
                        "greens": episode_greens,
                        "reds": episode_reds
                    })
            
            # Fim do episódio
            self.agent.episodes_done += 1
            self.agent.decay_epsilon()
            
            # Métricas do episódio
            total_ops = episode_greens + episode_reds
            winrate = (episode_greens / total_ops * 100) if total_ops > 0 else 0
            roi = ((self.agent.bankroll - self.agent.config.initial_bankroll) / self.agent.config.initial_bankroll * 100)
            avg_loss = np.mean(episode_losses) if episode_losses else 0
            
            self.agent.metrics["episode_rewards"].append(episode_reward)
            self.agent.metrics["episode_winrates"].append(winrate)
            self.agent.metrics["episode_rois"].append(roi)
            self.agent.metrics["bankrolls"].append(self.agent.bankroll)
            self.agent.metrics["losses"].append(avg_loss)
            
            # Log
            print(f"\n{'─'*60}")
            print(f"📊 EPISÓDIO {episode + 1}/{num_episodes}")
            print(f"{'─'*60}")
            print(f"  🎯 Operações: G:{episode_greens} R:{episode_reds} Skip:{episode_skips}")
            print(f"  📈 Win Rate: {winrate:.1f}%")
            print(f"  💰 ROI: {roi:+.2f}%")
            print(f"  💵 Bankroll: ${self.agent.bankroll:.2f}")
            print(f"  📉 Loss: {avg_loss:.4f}")
            print(f"  🎲 Epsilon: {self.agent.epsilon:.3f}")
            print(f"{'─'*60}\n")
            
            # Broadcast update completo do episódio
            await self.broadcast_training_update({
                "type": "episode_complete",
                "episode": episode,
                "total_episodes": num_episodes,
                "winrate": winrate,
                "roi": roi,
                "bankroll": self.agent.bankroll,
                "greens": episode_greens,
                "reds": episode_reds,
                "skips": episode_skips,
                "epsilon": self.agent.epsilon
            })
            
            # Salvar modelo
            if (episode + 1) % save_interval == 0:
                model_path = f"models/betting_ai_episode_{episode+1}.pt"
                self.agent.save_model(model_path)
                
                await self.broadcast_training_update({
                    "type": "model_saved",
                    "path": model_path,
                    "episode": episode
                })
        
        # Treinamento concluído
        self.is_training = False
        
        print(f"\n{'='*60}")
        print(f"✅ TREINAMENTO CONCLUÍDO!")
        print(f"{'='*60}")
        print(f"🎮 Episódios completados: {num_episodes}")
        print(f"📊 Win Rate Final: {self.agent.metrics['episode_winrates'][-1]:.1f}%")
        print(f"💰 ROI Final: {self.agent.metrics['episode_rois'][-1]:+.2f}%")
        print(f"💵 Bankroll Final: ${self.agent.metrics['bankrolls'][-1]:.2f}")
        print(f"{'='*60}\n")
        
        # Salvar modelo final
        final_model_path = f"models/betting_ai_final.pt"
        self.agent.save_model(final_model_path)
        
        await self.broadcast_training_update({
            "type": "training_complete",
            "model_path": final_model_path,
            "final_stats": {
                "winrate": self.agent.metrics['episode_winrates'][-1],
                "roi": self.agent.metrics['episode_rois'][-1],
                "bankroll": self.agent.metrics['bankrolls'][-1]
            }
        })
    
    async def evaluate(self, model_path: str, test_start: str, test_end: str) -> Dict:
        """
        Avalia modelo em dados de teste.
        
        Returns:
            Métricas de avaliação
        """
        
        # Carregar modelo
        if self.agent is None:
            config = AIConfig()
            self.agent = BettingAgent(config)
        
        self.agent.load_model(model_path)
        self.agent.bankroll = self.agent.config.initial_bankroll
        self.agent.history = []
        
        # Carregar dados de teste
        test_matches = await self.load_matches(test_start, test_end)
        
        print(f"\n{'='*60}")
        print(f"🔍 AVALIANDO MODELO")
        print(f"{'='*60}")
        print(f"📂 Modelo: {model_path}")
        print(f"📅 Período de teste: {test_start} a {test_end}")
        print(f"🎯 Partidas: {len(test_matches)}")
        print(f"{'='*60}\n")
        
        greens = 0
        reds = 0
        skips = 0
        decisions = []
        
        # Avaliar
        for match in test_matches:
            state = self.agent.feature_extractor.extract(match, self.agent.history)
            
            # Usar policy sem exploração
            action = self.agent.select_action(state, training=False)
            
            match_result = self.check_over35(match)
            odd = match.get("markets", {}).get("TotalGols_MaisDe_35", 2.0)
            
            reward = self.agent.calculate_reward(action, match_result, odd)
            
            if action in [0, 1]:
                if match_result:
                    greens += 1
                else:
                    reds += 1
                
                decisions.append({
                    "date": match.get("date"),
                    "hour": match.get("hour"),
                    "home": match.get("timeCasa"),
                    "away": match.get("timeFora"),
                    "action": "HIGH" if action == 0 else "LOW",
                    "odd": odd,
                    "result": "GREEN" if match_result else "RED",
                    "bankroll": self.agent.bankroll
                })
            else:
                skips += 1
            
            self.agent.history.append({
                "result": 1 if (action in [0, 1] and match_result) else 0,
                "bankroll": self.agent.bankroll
            })
        
        # Métricas
        total_ops = greens + reds
        winrate = (greens / total_ops * 100) if total_ops > 0 else 0
        roi = ((self.agent.bankroll - self.agent.config.initial_bankroll) / self.agent.config.initial_bankroll * 100)
        
        # Drawdown
        bankroll_history = [d["bankroll"] for d in decisions]
        if bankroll_history:
            peak = max(bankroll_history)
            trough = min(bankroll_history[bankroll_history.index(peak):]) if peak in bankroll_history else min(bankroll_history)
            max_drawdown = ((peak - trough) / peak * 100) if peak > 0 else 0
        else:
            max_drawdown = 0
        
        # Sharpe Ratio (aproximado)
        if len(decisions) > 1:
            returns = [decisions[i]["bankroll"] - decisions[i-1]["bankroll"] for i in range(1, len(decisions))]
            sharpe = (np.mean(returns) / np.std(returns)) if np.std(returns) > 0 else 0
        else:
            sharpe = 0
        
        results = {
            "total_matches": len(test_matches),
            "operations": total_ops,
            "greens": greens,
            "reds": reds,
            "skips": skips,
            "winrate": round(winrate, 2),
            "roi": round(roi, 2),
            "final_bankroll": round(self.agent.bankroll, 2),
            "max_drawdown": round(max_drawdown, 2),
            "sharpe_ratio": round(sharpe, 2),
            "decisions": decisions[-100:]  # Últimas 100 decisões
        }
        
        print(f"\n{'='*60}")
        print(f"📊 RESULTADOS DA AVALIAÇÃO")
        print(f"{'='*60}")
        print(f"  🎯 Operações: {total_ops} (G:{greens} R:{reds})")
        print(f"  ⏭️  Skips: {skips}")
        print(f"  📈 Win Rate: {winrate:.1f}%")
        print(f"  💰 ROI: {roi:+.2f}%")
        print(f"  💵 Bankroll Final: ${self.agent.bankroll:.2f}")
        print(f"  📉 Max Drawdown: {max_drawdown:.1f}%")
        print(f"  📊 Sharpe Ratio: {sharpe:.2f}")
        print(f"{'='*60}\n")
        
        return results
    
    async def predict(self, match_data: Dict, model_path: Optional[str] = None) -> Dict:
        """
        Faz predição para uma única partida.
        
        Args:
            match_data: Dados da partida
            model_path: Caminho do modelo (opcional, usa atual se None)
        
        Returns:
            Decisão e confiança
        """
        
        # Carregar modelo se especificado
        if model_path and self.agent:
            self.agent.load_model(model_path)
        
        if self.agent is None:
            raise ValueError("Nenhum modelo carregado")
        
        # Extrair features
        state = self.agent.feature_extractor.extract(match_data, self.agent.history)
        
        # Predição (sem exploração)
        with torch.no_grad():
            state_tensor = torch.FloatTensor(state).unsqueeze(0).to(self.agent.device)
            q_values = self.agent.policy_net(state_tensor)
            action = q_values.argmax().item()
            confidence = torch.softmax(q_values, dim=1).max().item()
        
        action_name = {
            0: "ENTRAR ALTO",
            1: "ENTRAR BAIXO",
            2: "PULAR",
            3: "HOLD"
        }[action]
        
        return {
            "action": action,
            "action_name": action_name,
            "confidence": round(confidence * 100, 2),
            "q_values": q_values.squeeze().cpu().numpy().tolist(),
            "odd": match_data.get("markets", {}).get("TotalGols_MaisDe_35", 0)
        }
    
    async def broadcast_training_update(self, message: Dict):
        """Envia update via WebSocket para todos os clientes"""
        
        if not self.websocket_clients:
            return
        
        disconnected = []
        
        for websocket in self.websocket_clients:
            try:
                await websocket.send_json(message)
            except:
                disconnected.append(websocket)
        
        # Remover clientes desconectados
        for ws in disconnected:
            self.websocket_clients.remove(ws)

# ==================== FASTAPI ROUTER ====================

from fastapi import APIRouter

router = APIRouter(prefix="/ai", tags=["AI Training"])

# Engine global
engine = None

async def init_engine(db):
    """Inicializa o engine (chamado pelo server.py)"""
    global engine
    engine = TrainingEngine(db)

# ==================== ENDPOINTS ====================

@router.post("/train")
@router.post("/train")
async def start_training(request: TrainingRequest):
    """Inicia treinamento da IA"""
    
    if engine.is_training:
        raise HTTPException(400, "Treinamento já em andamento")
    
    # Iniciar treinamento em background
    asyncio.create_task(engine.train(
        request.num_episodes,
        request.data_start_date,
        request.data_end_date,
        request.save_interval
    ))
    
    return {"message": "Treinamento iniciado", "status": "running"}

@router.post("/pause")
async def pause_training():
    """Pausa treinamento"""
    engine.is_paused = True
    return {"message": "Treinamento pausado"}

@router.post("/resume")
async def resume_training():
    """Resume treinamento"""
    engine.is_paused = False
    return {"message": "Treinamento resumido"}

@router.post("/stop")
async def stop_training():
    """Para treinamento"""
    engine.is_training = False
    return {"message": "Treinamento parado"}

@router.get("/status")
async def get_status():
    """Retorna status atual do treinamento"""
    
    if not engine or not engine.agent:
        return {"status": "not_initialized"}
    
    return {
        "status": "training" if engine.is_training else "idle",
        "paused": engine.is_paused,
        "episode": engine.current_episode,
        "epsilon": engine.agent.epsilon,
        "bankroll": engine.agent.bankroll,
        "metrics": {
            "latest_winrate": engine.agent.metrics["episode_winrates"][-1] if engine.agent.metrics["episode_winrates"] else 0,
            "latest_roi": engine.agent.metrics["episode_rois"][-1] if engine.agent.metrics["episode_rois"] else 0
        }
    }

@router.post("/evaluate")
async def evaluate_model(request: EvaluationRequest):
    """Avalia modelo em dados de teste"""
    
    results = await engine.evaluate(
        request.model_path,
        request.test_data_start,
        request.test_data_end
    )
    
    return results

@router.post("/predict")
async def predict_match(request: PredictionRequest):
    """Faz predição para uma partida"""
    
    prediction = await engine.predict(request.match_data, request.model_path)
    
    return prediction

@router.get("/feature-importance")
async def get_feature_importance():
    """Retorna importância das features"""
    
    if not engine.agent:
        raise HTTPException(400, "Modelo não inicializado")
    
    importance = engine.agent.feature_extractor.get_feature_importance(
        engine.agent.policy_net,
        engine.agent.device
    )
    
    return {"feature_importance": importance}

@router.websocket("/training-updates")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket para updates em tempo real"""
    
    await websocket.accept()
    engine.websocket_clients.append(websocket)
    
    try:
        while True:
            # Manter conexão aberta
            await websocket.receive_text()
    except WebSocketDisconnect:
        engine.websocket_clients.remove(websocket)