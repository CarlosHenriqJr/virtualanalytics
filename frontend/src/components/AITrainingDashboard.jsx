/**
 * AITrainingDashboard.jsx - Dashboard com tratamento robusto de valores undefined
 */

import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Play, Pause, Square, Brain, TrendingUp, TrendingDown,
  Zap, Target, Activity, Award, AlertCircle, Flame
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

// ✅ Helper para valores seguros
const safeNumber = (value, defaultValue = 0) => {
  return (value !== null && value !== undefined && !isNaN(value)) ? value : defaultValue;
};

const safeToFixed = (value, decimals = 1, defaultValue = 0) => {
  const num = safeNumber(value, defaultValue);
  return num.toFixed(decimals);
};

export default function AITrainingDashboard({ dbConnected }) {
  // Estados
  const [trainingStatus, setTrainingStatus] = useState('idle');
  const [trainingConfig, setTrainingConfig] = useState({
    num_episodes: 100,
    data_start_date: '2025-01-01',
    data_end_date: '2025-01-31',
    save_interval: 25
  });
  
  const [metrics, setMetrics] = useState({
    episode: 0,
    total_episodes: 100,
    winrate: 0,
    roi: 0,
    bankroll: 1000,
    epsilon: 1.0,
    greens: 0,
    reds: 0,
    skips: 0
  });
  
  const [evolutionData, setEvolutionData] = useState([]);
  const [featureImportance, setFeatureImportance] = useState([]);
  const [blockStats, setBlockStats] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [loading, setLoading] = useState(false);
  
  const wsRef = useRef(null);

  // WebSocket
  useEffect(() => {
    if (trainingStatus === 'training') {
      connectWebSocket();
    }
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [trainingStatus]);

  const connectWebSocket = () => {
    const wsUrl = API_BASE_URL.replace('http', 'ws') + '/ai/training-updates';
    wsRef.current = new WebSocket(wsUrl);

    wsRef.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === 'episode_complete') {
        setMetrics(prev => ({
          ...prev,
          episode: safeNumber(data.episode, prev.episode),
          winrate: safeNumber(data.winrate, prev.winrate),
          roi: safeNumber(data.roi, prev.roi),
          bankroll: safeNumber(data.bankroll, prev.bankroll),
          epsilon: safeNumber(data.epsilon, prev.epsilon),
          greens: safeNumber(data.greens, prev.greens),
          reds: safeNumber(data.reds, prev.reds),
          skips: safeNumber(data.skips, prev.skips)
        }));
        
        setEvolutionData(prev => [...prev, {
          episode: safeNumber(data.episode),
          winrate: safeNumber(data.winrate),
          roi: safeNumber(data.roi),
          bankroll: safeNumber(data.bankroll)
        }]);
      } else if (data.type === 'training_complete') {
        setTrainingStatus('idle');
        setSuccess('🎉 Treinamento concluído com sucesso!');
        loadFeatureImportance();
        loadBlockStats();
      } else if (data.type === 'model_saved') {
        setSuccess(`💾 Modelo salvo: ${data.path}`);
      } else {
        setMetrics(prev => ({
          ...prev,
          ...data
        }));
      }
    };

    wsRef.current.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    wsRef.current.onclose = () => {
      console.log('WebSocket closed');
    };
  };

  const handleStartTraining = async () => {
    try {
      setLoading(true);
      setError(null);
      setEvolutionData([]);
      
      await axios.post(`${API_BASE_URL}/ai/train`, trainingConfig);
      
      setTrainingStatus('training');
      setSuccess('✅ Treinamento iniciado!');
    } catch (err) {
      setError('Erro ao iniciar treinamento: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handlePauseTraining = async () => {
    try {
      await axios.post(`${API_BASE_URL}/ai/pause`);
      setTrainingStatus('paused');
    } catch (err) {
      setError('Erro ao pausar: ' + err.message);
    }
  };

  const handleResumeTraining = async () => {
    try {
      await axios.post(`${API_BASE_URL}/ai/resume`);
      setTrainingStatus('training');
    } catch (err) {
      setError('Erro ao resumir: ' + err.message);
    }
  };

  const handleStopTraining = async () => {
    try {
      await axios.post(`${API_BASE_URL}/ai/stop`);
      setTrainingStatus('idle');
      setSuccess('Treinamento parado');
    } catch (err) {
      setError('Erro ao parar: ' + err.message);
    }
  };

  const loadFeatureImportance = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/ai/feature-importance`);
      
      const importance = Object.entries(response.data.feature_importance || {})
        .slice(0, 10)
        .map(([name, value]) => ({
          name: name.replace(/_/g, ' '),
          importance: safeToFixed(value * 100, 1)
        }));
      
      setFeatureImportance(importance);
    } catch (err) {
      console.error('Erro ao carregar feature importance:', err);
    }
  };

  const loadBlockStats = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/ai/block-stats`);
      setBlockStats(response.data);
    } catch (err) {
      console.error('Erro ao carregar block stats:', err);
    }
  };

  const loadStatus = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/ai/status`);
      
      if (response.data.status === 'training') {
        setTrainingStatus('training');
      } else if (response.data.paused) {
        setTrainingStatus('paused');
      } else {
        setTrainingStatus('idle');
      }
      
      setMetrics(prev => ({
        ...prev,
        bankroll: safeNumber(response.data.bankroll, prev.bankroll),
        epsilon: safeNumber(response.data.epsilon, prev.epsilon),
        winrate: safeNumber(response.data.metrics?.latest_winrate, prev.winrate),
        roi: safeNumber(response.data.metrics?.latest_roi, prev.roi)
      }));
    } catch (err) {
      console.error('Erro ao carregar status:', err);
    }
  };

  useEffect(() => {
    if (dbConnected) {
      loadStatus();
    }
  }, [dbConnected]);

  const progress = metrics.total_episodes > 0 
    ? (metrics.episode / metrics.total_episodes * 100) 
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Brain className="w-10 h-10 animate-pulse" />
            <div>
              <h1 className="text-3xl font-bold">IA Trading Bot</h1>
              <p className="text-purple-100">Deep Q-Learning para Over 3.5</p>
            </div>
          </div>
          
          <div className="flex gap-3">
            {trainingStatus === 'idle' && (
              <Button
                onClick={handleStartTraining}
                disabled={loading || !dbConnected}
                className="bg-green-500 hover:bg-green-600"
              >
                <Play className="w-5 h-5 mr-2" />
                Treinar
              </Button>
            )}
            
            {trainingStatus === 'training' && (
              <Button
                onClick={handlePauseTraining}
                className="bg-yellow-500 hover:bg-yellow-600"
              >
                <Pause className="w-5 h-5 mr-2" />
                Pausar
              </Button>
            )}
            
            {trainingStatus === 'paused' && (
              <Button
                onClick={handleResumeTraining}
                className="bg-blue-500 hover:bg-blue-600"
              >
                <Play className="w-5 h-5 mr-2" />
                Continuar
              </Button>
            )}
            
            {trainingStatus !== 'idle' && (
              <Button
                onClick={handleStopTraining}
                variant="destructive"
              >
                <Square className="w-5 h-5 mr-2" />
                Parar
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Alertas */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="w-4 h-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="bg-green-50 border-green-200">
          <AlertDescription className="text-green-800">{success}</AlertDescription>
        </Alert>
      )}

      {/* Configuração */}
      {trainingStatus === 'idle' && (
        <Card>
          <CardHeader>
            <CardTitle>⚙️ Configuração de Treinamento</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label>Episódios</Label>
                <Input
                  type="number"
                  value={trainingConfig.num_episodes}
                  onChange={(e) => setTrainingConfig({
                    ...trainingConfig,
                    num_episodes: parseInt(e.target.value) || 100
                  })}
                  min="10"
                  max="500"
                />
              </div>
              <div>
                <Label>Data Inicial</Label>
                <Input
                  type="date"
                  value={trainingConfig.data_start_date}
                  onChange={(e) => setTrainingConfig({
                    ...trainingConfig,
                    data_start_date: e.target.value
                  })}
                />
              </div>
              <div>
                <Label>Data Final</Label>
                <Input
                  type="date"
                  value={trainingConfig.data_end_date}
                  onChange={(e) => setTrainingConfig({
                    ...trainingConfig,
                    data_end_date: e.target.value
                  })}
                />
              </div>
              <div>
                <Label>Salvar a cada N episódios</Label>
                <Input
                  type="number"
                  value={trainingConfig.save_interval}
                  onChange={(e) => setTrainingConfig({
                    ...trainingConfig,
                    save_interval: parseInt(e.target.value) || 25
                  })}
                  min="10"
                  max="100"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Progress Bar */}
      {trainingStatus !== 'idle' && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Episódio {metrics.episode} de {metrics.total_episodes}</span>
                <span className="font-bold">{safeToFixed(progress, 1)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-4">
                <div
                  className="bg-gradient-to-r from-purple-500 to-indigo-500 h-4 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              {trainingStatus === 'paused' && (
                <p className="text-sm text-yellow-600 font-medium">⏸️ Treinamento pausado</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cards de Métricas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Win Rate</p>
                <p className="text-3xl font-bold text-green-600">
                  {safeToFixed(metrics.winrate, 1)}%
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">ROI</p>
                <p className={`text-3xl font-bold ${metrics.roi >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {metrics.roi >= 0 ? '+' : ''}{safeToFixed(metrics.roi, 1)}%
                </p>
              </div>
              {metrics.roi >= 0 ? (
                <TrendingUp className="w-8 h-8 text-green-600" />
              ) : (
                <TrendingDown className="w-8 h-8 text-red-600" />
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Bankroll</p>
                <p className="text-3xl font-bold text-blue-600">
                  ${safeToFixed(metrics.bankroll, 0)}
                </p>
              </div>
              <Activity className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Exploração</p>
                <p className="text-3xl font-bold text-purple-600">
                  {safeToFixed(metrics.epsilon * 100, 0)}%
                </p>
              </div>
              <Zap className="w-8 h-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Estatísticas de Operações */}
      {trainingStatus !== 'idle' && (
        <Card>
          <CardHeader>
            <CardTitle>📊 Estatísticas do Episódio Atual</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-6">
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <p className="text-4xl font-bold text-green-600">{safeNumber(metrics.greens)}</p>
                <p className="text-sm text-gray-600">Greens</p>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <p className="text-4xl font-bold text-red-600">{safeNumber(metrics.reds)}</p>
                <p className="text-sm text-gray-600">Reds</p>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-4xl font-bold text-gray-600">{safeNumber(metrics.skips)}</p>
                <p className="text-sm text-gray-600">Skips</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Gráfico de Evolução */}
      {evolutionData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>📈 Evolução do Treinamento</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={evolutionData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="episode" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="winrate" stroke="#10b981" strokeWidth={2} name="Win Rate (%)" />
                <Line yAxisId="left" type="monotone" dataKey="roi" stroke="#3b82f6" strokeWidth={2} name="ROI (%)" />
                <Line yAxisId="right" type="monotone" dataKey="bankroll" stroke="#8b5cf6" strokeWidth={2} name="Bankroll ($)" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Feature Importance */}
      {featureImportance.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>🧠 Features Mais Importantes</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={featureImportance} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis type="category" dataKey="name" width={150} />
                <Tooltip />
                <Bar dataKey="importance" fill="#8b5cf6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
      
      {/* Blocos Temporais - COM TRATAMENTO ROBUSTO */}
      {blockStats && blockStats.total_blocks > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Flame className="w-5 h-5 text-orange-600" />
              🔥 Blocos Temporais Detectados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="p-3 bg-orange-50 rounded-lg">
                <p className="text-sm text-gray-600">Total de Blocos</p>
                <p className="text-2xl font-bold text-orange-600">
                  {safeNumber(blockStats.total_blocks)}
                </p>
              </div>
              <div className="p-3 bg-orange-50 rounded-lg">
                <p className="text-sm text-gray-600">Tamanho Médio</p>
                <p className="text-2xl font-bold text-orange-600">
                  {safeToFixed(blockStats.avg_block_size, 1)}
                </p>
              </div>
              <div className="p-3 bg-orange-50 rounded-lg">
                <p className="text-sm text-gray-600">Maior Bloco</p>
                <p className="text-2xl font-bold text-orange-600">
                  {safeNumber(blockStats.max_block_size)}
                </p>
              </div>
              <div className="p-3 bg-orange-50 rounded-lg">
                <p className="text-sm text-gray-600">Blocos/Dia</p>
                <p className="text-2xl font-bold text-orange-600">
                  {safeToFixed(blockStats.blocks_per_day, 1)}
                </p>
              </div>
            </div>
            
            {blockStats.example_blocks && blockStats.example_blocks.length > 0 && (
              <div>
                <h4 className="font-bold mb-2">Exemplos de Blocos:</h4>
                {blockStats.example_blocks.map((block, index) => (
                  <div key={index} className="mb-3 p-3 bg-gray-50 rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium">
                        {block.start_time || 'N/A'} - {block.end_time || 'N/A'}
                      </span>
                      <span className="text-sm text-gray-600">
                        {safeNumber(block.size)} overs em {safeToFixed(block.duration_min, 0)} min
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Info sobre a IA */}
      <Card className="bg-gradient-to-r from-indigo-50 to-purple-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="w-5 h-5 text-purple-600" />
            Como Funciona a IA
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-bold mb-2 text-purple-900">🎯 O que ela aprende:</h3>
              <ul className="space-y-1 text-sm text-gray-700">
                <li>• Padrões de odds que indicam over 3.5</li>
                <li>• Quando entrar com stake alto ou baixo</li>
                <li>• Quando pular e economizar bankroll</li>
                <li>• Gestão de risco baseada em drawdown</li>
                <li>• 🔥 Blocos temporais (hora anterior)</li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-bold mb-2 text-purple-900">🧠 Técnica:</h3>
              <ul className="space-y-1 text-sm text-gray-700">
                <li>• <strong>Deep Q-Learning (DQN)</strong></li>
                <li>• Rede neural: 256→128→64 neurônios</li>
                <li>• 61 features (50 odds + 11 temporais)</li>
                <li>• Experience Replay (10k memórias)</li>
                <li>• Exploration → Exploitation (epsilon decay)</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}