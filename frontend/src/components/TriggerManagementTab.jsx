/**
 * TriggerManagementTab.jsx - Gerenciamento e Cruzamento de Gatilhos
 * 
 * Funcionalidades:
 * 1. Criar/Editar/Excluir gatilhos personalizados
 * 2. Análise cruzada de desempenho
 * 3. Detecção de reversão de performance
 */

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Plus, Edit2, Trash2, Target, TrendingUp, TrendingDown, 
  BarChart3, Calendar, CheckCircle, XCircle, RefreshCw 
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

export default function TriggerManagementTab({ dbConnected }) {
  const [activeTab, setActiveTab] = useState('list'); // 'list', 'create', 'cross-analysis'
  const [triggers, setTriggers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    trigger_condition: '{"IntervaloVencedor": "Visitante"}',
    target_market: 'TotalGols_MaisDe_35',
    skip_games: 0,
    max_attempts: 3
  });

  // Cross analysis states
  const [selectedTriggers, setSelectedTriggers] = useState([]);
  const [analysisResults, setAnalysisResults] = useState(null);
  const [analysisParams, setAnalysisParams] = useState({
    start_date: '',
    end_date: '',
    include_reversal_analysis: true
  });

  // Edição
  const [editingTrigger, setEditingTrigger] = useState(null);

  useEffect(() => {
    if (dbConnected) {
      loadTriggers();
    }
  }, [dbConnected]);

  const loadTriggers = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE_URL}/trigger-management/triggers`);
      setTriggers(response.data.triggers || []);
    } catch (err) {
      setError('Erro ao carregar gatilhos: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTrigger = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      // Validar JSON do trigger_condition
      JSON.parse(formData.trigger_condition);
    } catch {
      setError('Condição do gatilho deve ser um JSON válido');
      return;
    }

    try {
      setLoading(true);
      
      const payload = {
        ...formData,
        trigger_condition: JSON.parse(formData.trigger_condition),
        skip_games: parseInt(formData.skip_games),
        max_attempts: parseInt(formData.max_attempts)
      };

      if (editingTrigger) {
        await axios.put(`${API_BASE_URL}/trigger-management/triggers/${editingTrigger._id}`, payload);
        setSuccess('Gatilho atualizado com sucesso!');
      } else {
        await axios.post(`${API_BASE_URL}/trigger-management/triggers`, payload);
        setSuccess('Gatilho criado com sucesso!');
      }

      // Resetar form
      setFormData({
        name: '',
        description: '',
        trigger_condition: '{"IntervaloVencedor": "Visitante"}',
        target_market: 'TotalGols_MaisDe_35',
        skip_games: 0,
        max_attempts: 3
      });
      setEditingTrigger(null);
      
      loadTriggers();
      setActiveTab('list');
    } catch (err) {
      setError('Erro ao salvar gatilho: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTrigger = async (triggerId) => {
    if (!window.confirm('Tem certeza que deseja excluir este gatilho?')) return;

    try {
      setLoading(true);
      await axios.delete(`${API_BASE_URL}/trigger-management/triggers/${triggerId}`);
      setSuccess('Gatilho excluído com sucesso!');
      loadTriggers();
    } catch (err) {
      setError('Erro ao excluir gatilho: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleEditTrigger = (trigger) => {
    setEditingTrigger(trigger);
    setFormData({
      name: trigger.name,
      description: trigger.description || '',
      trigger_condition: JSON.stringify(trigger.trigger_condition, null, 2),
      target_market: trigger.target_market,
      skip_games: trigger.skip_games,
      max_attempts: trigger.max_attempts
    });
    setActiveTab('create');
  };

  const handleCrossAnalysis = async (useCache = true) => {
    if (selectedTriggers.length < 2) {
      setError('Selecione pelo menos 2 gatilhos para análise cruzada');
      return;
    }

    if (!analysisParams.start_date || !analysisParams.end_date) {
      setError('Selecione o período de análise');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Usar endpoint rápido (cache) ou lento (tempo real)
      const endpoint = useCache 
        ? `${API_BASE_URL}/trigger-cache/cross-analysis-fast`
        : `${API_BASE_URL}/trigger-management/cross-analysis`;

      const response = await axios.post(endpoint, {
        trigger_ids: selectedTriggers,
        start_date: analysisParams.start_date,
        end_date: analysisParams.end_date,
        include_reversal_analysis: analysisParams.include_reversal_analysis
      });

      setAnalysisResults(response.data);
      
      // Se veio do cache vazio, sugerir atualização
      if (response.data.source === 'cache' && response.data.daily_performance.length === 0) {
        setError('⚠️ Cache vazio. Clique em "Atualizar Cache" primeiro.');
      }
    } catch (err) {
      setError('Erro na análise cruzada: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateCache = async (triggerId = null) => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      const response = await axios.post(`${API_BASE_URL}/trigger-cache/update`, {
        trigger_id: triggerId,
        force_recalculate: false
      });

      setSuccess(`✅ Cache atualizado! ${response.data.cache_records} registros criados.`);
      
      // Recarregar status do cache
      loadCacheStatus();
    } catch (err) {
      setError('Erro ao atualizar cache: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleDebugTrigger = async (triggerId, date) => {
    try {
      setLoading(true);
      
      const response = await axios.post(`${API_BASE_URL}/trigger-cache/debug-trigger`, {
        trigger_id: triggerId,
        date: date
      });

      // Mostrar debug em uma modal ou console
      console.log('🔍 DEBUG DO GATILHO:', response.data);
      alert(`Debug do Gatilho:\n\n` +
        `Total de partidas: ${response.data.total_matches}\n` +
        `Partidas que bateram: ${response.data.matches_triggered}\n` +
        `Greens: ${response.data.statistics.greens}\n` +
        `Reds: ${response.data.statistics.reds}\n\n` +
        `Veja o console (F12) para detalhes completos.`
      );
    } catch (err) {
      setError('Erro no debug: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  const [cacheStatus, setCacheStatus] = useState([]);

  const loadCacheStatus = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/trigger-cache/status`);
      setCacheStatus(response.data.triggers || []);
    } catch (err) {
      console.error('Erro ao carregar status do cache:', err);
    }
  };

  useEffect(() => {
    if (dbConnected && activeTab === 'cross-analysis') {
      loadCacheStatus();
    }
  }, [dbConnected, activeTab]);

  const toggleTriggerSelection = (triggerId) => {
    setSelectedTriggers(prev => 
      prev.includes(triggerId) 
        ? prev.filter(id => id !== triggerId)
        : [...prev, triggerId]
    );
  };

  // Preparar dados para gráfico
  const prepareChartData = () => {
    if (!analysisResults?.daily_performance) return [];

    const groupedByDate = {};
    analysisResults.daily_performance.forEach(perf => {
      if (!groupedByDate[perf.date]) {
        groupedByDate[perf.date] = { date: perf.date };
      }
      groupedByDate[perf.date][perf.trigger_name] = perf.success_rate;
    });

    return Object.values(groupedByDate);
  };

  return (
    <div className="space-y-6">
      {/* Navegação */}
      <div className="flex space-x-4 border-b border-gray-200">
        <button
          className={`px-4 py-2 font-medium ${
            activeTab === 'list'
              ? 'border-b-2 border-blue-500 text-blue-600'
              : 'text-gray-600 hover:text-gray-800'
          }`}
          onClick={() => setActiveTab('list')}
        >
          📋 Lista de Gatilhos
        </button>
        <button
          className={`px-4 py-2 font-medium ${
            activeTab === 'create'
              ? 'border-b-2 border-green-500 text-green-600'
              : 'text-gray-600 hover:text-gray-800'
          }`}
          onClick={() => {
            setEditingTrigger(null);
            setActiveTab('create');
          }}
        >
          ➕ {editingTrigger ? 'Editar' : 'Criar'} Gatilho
        </button>
        <button
          className={`px-4 py-2 font-medium ${
            activeTab === 'cross-analysis'
              ? 'border-b-2 border-purple-500 text-purple-600'
              : 'text-gray-600 hover:text-gray-800'
          }`}
          onClick={() => setActiveTab('cross-analysis')}
        >
          🔄 Análise Cruzada
        </button>
      </div>

      {/* Alertas */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="bg-green-50 border-green-200">
          <AlertDescription className="text-green-800">{success}</AlertDescription>
        </Alert>
      )}

      {/* Conteúdo das Abas */}
      {activeTab === 'list' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">Gatilhos Salvos ({triggers.length})</h2>
            <Button onClick={loadTriggers} disabled={loading}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Atualizar
            </Button>
          </div>

          {triggers.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Target className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-600">Nenhum gatilho salvo ainda.</p>
                <Button onClick={() => setActiveTab('create')} className="mt-4">
                  Criar Primeiro Gatilho
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {triggers.map(trigger => (
                <Card key={trigger._id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <Target className="w-5 h-5 text-blue-600" />
                        {trigger.name}
                      </span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEditTrigger(trigger)}
                          className="p-2 hover:bg-gray-100 rounded"
                        >
                          <Edit2 className="w-4 h-4 text-blue-600" />
                        </button>
                        <button
                          onClick={() => handleDeleteTrigger(trigger._id)}
                          className="p-2 hover:bg-gray-100 rounded"
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </button>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {trigger.description && (
                      <p className="text-sm text-gray-600 mb-3">{trigger.description}</p>
                    )}
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Condição:</span>
                        <code className="bg-gray-100 px-2 py-1 rounded text-xs">
                          {JSON.stringify(trigger.trigger_condition)}
                        </code>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Mercado:</span>
                        <span className="font-medium">{trigger.target_market}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Gales:</span>
                        <span className="font-medium">{trigger.max_attempts}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Skip:</span>
                        <span className="font-medium">{trigger.skip_games}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'create' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5" />
              {editingTrigger ? 'Editar Gatilho' : 'Criar Novo Gatilho'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateTrigger} className="space-y-4">
              <div>
                <Label>Nome do Gatilho *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Gatilho Visitante Intervalo"
                  required
                />
              </div>

              <div>
                <Label>Descrição (Opcional)</Label>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descrição do comportamento do gatilho"
                />
              </div>

              <div>
                <Label>Condição do Gatilho (JSON) *</Label>
                <textarea
                  className="w-full px-3 py-2 border rounded-md font-mono text-sm"
                  rows={4}
                  value={formData.trigger_condition}
                  onChange={(e) => setFormData({ ...formData, trigger_condition: e.target.value })}
                  placeholder='{"IntervaloVencedor": "Visitante"}'
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Exemplos: {'{'}&#34;placarHT&#34;: &#34;0-0&#34;{'}'}  ou  {'{'}&#34;posicaoMandante&#34;: {'{'}&#34;$lte&#34;: 5{'}'},&#34;posicaoVisitante&#34;: {'{'}&#34;$gte&#34;: 10{'}'}{'}'}
                </p>
              </div>

              <div>
                <Label>Mercado Alvo *</Label>
                <select
                  className="w-full px-3 py-2 border rounded-md"
                  value={formData.target_market}
                  onChange={(e) => setFormData({ ...formData, target_market: e.target.value })}
                  required
                >
                  <option value="TotalGols_MaisDe_35">Over 3.5 Gols</option>
                  <option value="TotalGols_MaisDe_25">Over 2.5 Gols</option>
                  <option value="TotalGols_MaisDe_45">Over 4.5 Gols</option>
                  <option value="ParaOTimeMarcarSimNao_AmbasMarcam">Ambas Marcam</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Máximo de Gales</Label>
                  <Input
                    type="number"
                    min="1"
                    max="5"
                    value={formData.max_attempts}
                    onChange={(e) => setFormData({ ...formData, max_attempts: e.target.value })}
                  />
                </div>

                <div>
                  <Label>Pular Jogos (Skip)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={formData.skip_games}
                    onChange={(e) => setFormData({ ...formData, skip_games: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <Button type="submit" disabled={loading} className="flex-1">
                  {loading ? 'Salvando...' : (editingTrigger ? 'Atualizar' : 'Criar')} Gatilho
                </Button>
                {editingTrigger && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setEditingTrigger(null);
                      setActiveTab('list');
                    }}
                  >
                    Cancelar
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {activeTab === 'cross-analysis' && (
        <div className="space-y-6">
          {/* Status do Cache */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <RefreshCw className="w-5 h-5" />
                  Status do Cache
                </span>
                <Button
                  onClick={() => handleUpdateCache()}
                  disabled={loading}
                  size="sm"
                  variant="outline"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  {loading ? 'Atualizando...' : 'Atualizar Todos'}
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {cacheStatus.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {cacheStatus.map(status => (
                    <div
                      key={status.trigger_id}
                      className={`p-3 border rounded-lg ${
                        status.cached ? 'border-green-200 bg-green-50' : 'border-gray-200'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-sm">{status.trigger_name}</span>
                        {status.cached ? (
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        ) : (
                          <XCircle className="w-4 h-4 text-gray-400" />
                        )}
                      </div>
                      {status.cached ? (
                        <div className="text-xs space-y-1">
                          <div>📅 {status.total_dates} dias</div>
                          <div className="text-gray-600">
                            {status.first_date} até {status.last_date}
                          </div>
                          {status.needs_update && (
                            <div className="text-orange-600 font-medium">⚠️ Precisa atualizar</div>
                          )}
                        </div>
                      ) : (
                        <div className="text-xs text-gray-600">Sem cache</div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-500 py-4">Carregando status...</p>
              )}
            </CardContent>
          </Card>

          {/* Seleção de Gatilhos */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Selecione os Gatilhos para Comparar
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {triggers.map(trigger => (
                  <button
                    key={trigger._id}
                    onClick={() => toggleTriggerSelection(trigger._id)}
                    className={`p-4 border-2 rounded-lg text-left transition-all ${
                      selectedTriggers.includes(trigger._id)
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">{trigger.name}</span>
                      {selectedTriggers.includes(trigger._id) && (
                        <CheckCircle className="w-5 h-5 text-blue-600" />
                      )}
                    </div>
                    <p className="text-xs text-gray-600 mb-2">
                      {JSON.stringify(trigger.trigger_condition)}
                    </p>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDebugTrigger(trigger._id, analysisParams.start_date || '2025-01-01');
                      }}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      🔍 Debug
                    </button>
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                <div>
                  <Label>Data Inicial</Label>
                  <Input
                    type="date"
                    value={analysisParams.start_date}
                    onChange={(e) => setAnalysisParams({ ...analysisParams, start_date: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Data Final</Label>
                  <Input
                    type="date"
                    value={analysisParams.end_date}
                    onChange={(e) => setAnalysisParams({ ...analysisParams, end_date: e.target.value })}
                  />
                </div>
                <div className="flex items-end gap-2">
                  <Button
                    onClick={() => handleCrossAnalysis(true)}
                    disabled={loading || selectedTriggers.length < 2}
                    className="flex-1"
                  >
                    {loading ? 'Analisando...' : '⚡ Análise Rápida'}
                  </Button>
                  <Button
                    onClick={() => handleCrossAnalysis(false)}
                    disabled={loading || selectedTriggers.length < 2}
                    variant="outline"
                    className="flex-1"
                  >
                    🔄 Tempo Real
                  </Button>
                </div>
              </div>
              
              <div className="mt-3 p-3 bg-blue-50 rounded text-xs text-gray-700">
                💡 <strong>Dica:</strong> Use "Análise Rápida" (com cache) para períodos longos. 
                Use "Tempo Real" apenas para validar dados recentes.
              </div>
            </CardContent>
          </Card>

          {/* Resultados */}
          {analysisResults && (
            <>
              {/* Insights */}
              {analysisResults.insights && analysisResults.insights.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>💡 Insights</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {analysisResults.insights.map((insight, idx) => (
                        <div key={idx} className="p-3 bg-blue-50 rounded-lg">
                          <p className="text-sm">{insight}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Gráfico de Comparação */}
              <Card>
                <CardHeader>
                  <CardTitle>📊 Comparação de Performance Diária</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={400}>
                    <LineChart data={prepareChartData()}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis label={{ value: 'Taxa de Sucesso (%)', angle: -90, position: 'insideLeft' }} />
                      <Tooltip />
                      <Legend />
                      {selectedTriggers.map((_, idx) => {
                        const trigger = triggers.find(t => t._id === selectedTriggers[idx]);
                        const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
                        return trigger ? (
                          <Line
                            key={trigger._id}
                            type="monotone"
                            dataKey={trigger.name}
                            stroke={colors[idx % colors.length]}
                            strokeWidth={2}
                          />
                        ) : null;
                      })}
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Tabela de Performance Diária */}
              <Card>
                <CardHeader>
                  <CardTitle>📋 Detalhamento por Dia</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="p-3 text-left">Data</th>
                          <th className="p-3 text-left">Gatilho</th>
                          <th className="p-3 text-center">Greens</th>
                          <th className="p-3 text-center">Reds</th>
                          <th className="p-3 text-center">Total</th>
                          <th className="p-3 text-center">Taxa</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analysisResults.daily_performance.map((perf, idx) => (
                          <tr key={idx} className="border-b hover:bg-gray-50">
                            <td className="p-3">{perf.date}</td>
                            <td className="p-3 font-medium">{perf.trigger_name}</td>
                            <td className="p-3 text-center">
                              <span className="inline-flex items-center gap-1 text-green-600 font-bold">
                                <CheckCircle className="w-4 h-4" />
                                {perf.greens}
                              </span>
                            </td>
                            <td className="p-3 text-center">
                              <span className="inline-flex items-center gap-1 text-red-600 font-bold">
                                <XCircle className="w-4 h-4" />
                                {perf.reds}
                              </span>
                            </td>
                            <td className="p-3 text-center font-medium">{perf.total_operations}</td>
                            <td className="p-3 text-center">
                              <span
                                className={`font-bold ${
                                  perf.success_rate >= 70
                                    ? 'text-green-600'
                                    : perf.success_rate >= 50
                                    ? 'text-yellow-600'
                                    : 'text-red-600'
                                }`}
                              >
                                {perf.success_rate.toFixed(1)}%
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              {/* Padrões de Reversão */}
              {analysisResults.reversal_patterns && analysisResults.reversal_patterns.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <RefreshCw className="w-5 h-5 text-purple-600" />
                      🔄 Padrões de Reversão Detectados
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {analysisResults.reversal_patterns.map((pattern, idx) => (
                        <div key={idx} className="p-4 border-2 border-purple-200 rounded-lg bg-purple-50">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-gray-600">{pattern.date}</span>
                            <span className="text-lg font-bold text-purple-600">
                              +{pattern.reversal_strength.toFixed(1)}%
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex-1">
                              <span className="text-red-600 font-medium">{pattern.trigger_poor}</span>
                              <span className="text-xs text-red-600 ml-2">
                                ({pattern.poor_success_rate.toFixed(1)}%)
                              </span>
                            </div>
                            <TrendingDown className="w-5 h-5 text-red-500" />
                            <div className="text-gray-400">→</div>
                            <TrendingUp className="w-5 h-5 text-green-500" />
                            <div className="flex-1 text-right">
                              <span className="text-green-600 font-medium">{pattern.trigger_good}</span>
                              <span className="text-xs text-green-600 ml-2">
                                ({pattern.good_success_rate.toFixed(1)}%)
                              </span>
                            </div>
                          </div>
                          <p className="text-xs text-gray-600 mt-2">
                            No dia seguinte ({pattern.next_date})
                          </p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Estatísticas Gerais */}
              {analysisResults.overall_statistics && (
                <Card>
                  <CardHeader>
                    <CardTitle>📈 Estatísticas Gerais</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {Object.values(analysisResults.overall_statistics).map((stats, idx) => (
                        <div key={idx} className="p-4 border rounded-lg">
                          <h3 className="font-bold text-lg mb-3">{stats.trigger_name}</h3>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-600">Taxa Geral:</span>
                              <span className="font-bold text-blue-600">
                                {stats.overall_success_rate}%
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Total Greens:</span>
                              <span className="font-bold text-green-600">{stats.total_greens}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Total Reds:</span>
                              <span className="font-bold text-red-600">{stats.total_reds}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">Dias Analisados:</span>
                              <span className="font-medium">{stats.days_analyzed}</span>
                            </div>
                            {stats.best_day && (
                              <div className="flex justify-between">
                                <span className="text-gray-600">Melhor Dia:</span>
                                <span className="text-xs">
                                  {stats.best_day.date} ({stats.best_day.success_rate.toFixed(1)}%)
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}