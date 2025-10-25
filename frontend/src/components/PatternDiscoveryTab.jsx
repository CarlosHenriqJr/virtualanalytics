/**
 * PatternDiscoveryTab.jsx - Componente para Descoberta Automática de Padrões
 * 
 * Permite ao usuário descobrir automaticamente os melhores padrões sequenciais
 * para um mercado-alvo, com análise de persistência temporal.
 */

import React, { useState } from 'react';
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

export default function PatternDiscoveryTab({
  selectedMarket,
  dbConnected,
  availableDates
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Parâmetros de busca
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [minDelay, setMinDelay] = useState(5);
  const [maxDelay, setMaxDelay] = useState(20);
  const [minEntries, setMinEntries] = useState(1);
  const [maxEntries, setMaxEntries] = useState(5);
  
  // Resultados
  const [discoveryResults, setDiscoveryResults] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);

  const handleDiscoverPatterns = async () => {
    if (!selectedMarket) {
      setError('Selecione um mercado primeiro');
      return;
    }

    if (!startDate || !endDate) {
      setError('Selecione o período de análise');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const response = await axios.post(`${API_BASE_URL}/pattern-discovery/discover-patterns`, {
        target_market: selectedMarket,
        start_date: startDate,
        end_date: endDate,
        min_delay: parseInt(minDelay),
        max_delay: parseInt(maxDelay),
        min_entries: parseInt(minEntries),
        max_entries: parseInt(maxEntries)
      });
      
      setDiscoveryResults(response.data);
      setSelectedDay(null);
    } catch (err) {
      setError('Erro ao descobrir padrões: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  const renderPatternCard = (pattern, index, isTopPattern = false) => {
    const successRate = (pattern.success_rate * 100).toFixed(1);
    const winRate = pattern.total_bets > 0 
      ? ((pattern.winning_bets / pattern.total_bets) * 100).toFixed(1)
      : 0;
    
    const bgColor = isTopPattern ? 'bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-300' : 'bg-white';
    const borderColor = isTopPattern ? 'border-2' : 'border';
    
    return (
      <div key={index} className={`${bgColor} ${borderColor} border-gray-200 rounded-lg p-4 mb-3`}>
        {isTopPattern && (
          <div className="flex items-center mb-2">
            <span className="bg-yellow-500 text-white text-xs font-bold px-2 py-1 rounded">
              🏆 MELHOR PADRÃO
            </span>
          </div>
        )}
        
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-sm font-semibold text-gray-700">Gatilho</p>
            <p className="text-sm text-gray-900">{pattern.trigger.description}</p>
          </div>
          
          <div>
            <p className="text-sm font-semibold text-gray-700">Configuração</p>
            <p className="text-sm text-gray-900">
              Delay: {pattern.delay_games} jogos | Entradas: {pattern.consecutive_entries}
            </p>
          </div>
          
          <div>
            <p className="text-sm font-semibold text-gray-700">Taxa de Sucesso</p>
            <p className={`text-lg font-bold ${
              pattern.success_rate >= 0.7 ? 'text-green-600' :
              pattern.success_rate >= 0.5 ? 'text-yellow-600' :
              'text-red-600'
            }`}>
              {successRate}%
            </p>
            <p className="text-xs text-gray-500">
              {pattern.successful_sequences} de {pattern.successful_sequences + pattern.failed_sequences} sequências
            </p>
          </div>
          
          <div>
            <p className="text-sm font-semibold text-gray-700">Apostas</p>
            <p className="text-sm text-gray-900">
              {pattern.winning_bets} / {pattern.total_bets} ganhas ({winRate}%)
            </p>
            <p className="text-xs text-gray-500">
              {pattern.total_occurrences} ocorrências do gatilho
            </p>
          </div>
        </div>
        
        <div className="mt-3 pt-3 border-t border-gray-200">
          <p className="text-xs text-gray-600">
            <strong>Pontuação:</strong> {(pattern.score * 100).toFixed(1)}/100
          </p>
        </div>
      </div>
    );
  };

  const renderPersistenceCard = (persistence, index) => {
    const isHighPersistence = persistence.persistence_score > 0.5;
    
    return (
      <div key={index} className={`border ${isHighPersistence ? 'border-purple-300 bg-purple-50' : 'border-gray-200 bg-white'} rounded-lg p-4 mb-3`}>
        {isHighPersistence && (
          <div className="flex items-center mb-2">
            <span className="bg-purple-500 text-white text-xs font-bold px-2 py-1 rounded">
              ⭐ ALTA PERSISTÊNCIA
            </span>
          </div>
        )}
        
        <div className="mb-3">
          <p className="text-sm font-semibold text-gray-700">Padrão</p>
          <p className="text-xs text-gray-600 font-mono bg-gray-100 p-2 rounded">
            {persistence.pattern_signature}
          </p>
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs font-semibold text-gray-700">Período</p>
            <p className="text-xs text-gray-900">
              {persistence.first_appearance} até {persistence.last_appearance}
            </p>
          </div>
          
          <div>
            <p className="text-xs font-semibold text-gray-700">Frequência</p>
            <p className="text-sm font-bold text-gray-900">
              {persistence.total_days_as_best} dias
            </p>
          </div>
          
          <div>
            <p className="text-xs font-semibold text-gray-700">Reaparece a cada</p>
            <p className="text-sm font-bold text-gray-900">
              {persistence.avg_reappearance_interval.toFixed(1)} dias
            </p>
          </div>
          
          <div>
            <p className="text-xs font-semibold text-gray-700">Pontuação</p>
            <p className={`text-sm font-bold ${
              persistence.persistence_score >= 0.7 ? 'text-green-600' :
              persistence.persistence_score >= 0.4 ? 'text-yellow-600' :
              'text-gray-600'
            }`}>
              {(persistence.persistence_score * 100).toFixed(1)}/100
            </p>
          </div>
        </div>
        
        {persistence.consecutive_days.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-200">
            <p className="text-xs font-semibold text-gray-700">Sequências Consecutivas</p>
            <div className="flex flex-wrap gap-2 mt-1">
              {persistence.consecutive_days.map((days, i) => (
                <span key={i} className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                  {days} dias
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      {/* Painel de Configuração */}
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-lg p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          🤖 Descoberta Automática de Padrões
        </h3>
        
        <p className="text-sm text-gray-700 mb-4">
          O sistema testará automaticamente múltiplas combinações de gatilhos, delays e entradas
          para descobrir os padrões mais assertivos em cada dia do período selecionado.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Período */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Data Inicial
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              min={availableDates?.oldest}
              max={availableDates?.newest}
              disabled={!dbConnected || loading}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Data Final
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={availableDates?.oldest}
              max={availableDates?.newest}
              disabled={!dbConnected || loading}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100"
            />
          </div>
          
          {/* Delay */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Delay (jogos)
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                value={minDelay}
                onChange={(e) => setMinDelay(e.target.value)}
                min="1"
                max="50"
                disabled={!dbConnected || loading}
                placeholder="Min"
                className="w-1/2 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100"
              />
              <input
                type="number"
                value={maxDelay}
                onChange={(e) => setMaxDelay(e.target.value)}
                min="1"
                max="50"
                disabled={!dbConnected || loading}
                placeholder="Max"
                className="w-1/2 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100"
              />
            </div>
          </div>
          
          {/* Entradas */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Entradas Consecutivas
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                value={minEntries}
                onChange={(e) => setMinEntries(e.target.value)}
                min="1"
                max="10"
                disabled={!dbConnected || loading}
                placeholder="Min"
                className="w-1/2 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100"
              />
              <input
                type="number"
                value={maxEntries}
                onChange={(e) => setMaxEntries(e.target.value)}
                min="1"
                max="10"
                disabled={!dbConnected || loading}
                placeholder="Max"
                className="w-1/2 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100"
              />
            </div>
          </div>
          
          {/* Botão */}
          <div className="md:col-span-2 lg:col-span-1 flex items-end">
            <button
              onClick={handleDiscoverPatterns}
              disabled={!dbConnected || loading || !selectedMarket}
              className="w-full px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {loading ? 'Descobrindo Padrões...' : '🔍 Descobrir Padrões'}
            </button>
          </div>
        </div>
        
        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-md p-3">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}
      </div>

      {/* Resultados */}
      {discoveryResults && (
        <div>
          {/* Resumo */}
          <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              📊 Resumo da Análise
            </h3>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-600">Período</p>
                <p className="text-lg font-semibold text-gray-900">
                  {discoveryResults.analysis_period.start_date} até {discoveryResults.analysis_period.end_date}
                </p>
              </div>
              
              <div>
                <p className="text-sm text-gray-600">Dias Analisados</p>
                <p className="text-2xl font-bold text-indigo-600">
                  {discoveryResults.total_days_analyzed}
                </p>
              </div>
              
              <div>
                <p className="text-sm text-gray-600">Padrões Persistentes</p>
                <p className="text-2xl font-bold text-purple-600">
                  {discoveryResults.pattern_persistence.length}
                </p>
              </div>
              
              <div>
                <p className="text-sm text-gray-600">Mercado-alvo</p>
                <p className="text-sm font-semibold text-gray-900">
                  {discoveryResults.target_market}
                </p>
              </div>
            </div>
            
            {discoveryResults.recommendations.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-sm font-semibold text-gray-700 mb-2">💡 Recomendações</p>
                <ul className="space-y-1">
                  {discoveryResults.recommendations.map((rec, i) => (
                    <li key={i} className="text-sm text-gray-700">• {rec}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Padrões Persistentes */}
          {discoveryResults.pattern_persistence.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                ⏰ Padrões Persistentes (Rastreamento Temporal)
              </h3>
              
              <p className="text-sm text-gray-600 mb-4">
                Padrões que se repetiram em múltiplos dias, ordenados por persistência.
              </p>
              
              {discoveryResults.pattern_persistence.map((persistence, i) => 
                renderPersistenceCard(persistence, i)
              )}
            </div>
          )}

          {/* Melhores Padrões por Dia */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              📅 Melhores Padrões por Dia
            </h3>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Selecione um dia para ver detalhes
              </label>
              <select
                value={selectedDay || ''}
                onChange={(e) => setSelectedDay(e.target.value ? parseInt(e.target.value) : null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">-- Selecione um dia --</option>
                {discoveryResults.daily_best_patterns.map((daily, i) => (
                  <option key={i} value={i}>
                    {daily.date} - {daily.best_pattern.trigger.description} ({(daily.best_pattern.success_rate * 100).toFixed(1)}%)
                  </option>
                ))}
              </select>
            </div>
            
            {selectedDay !== null && discoveryResults.daily_best_patterns[selectedDay] && (
              <div>
                <h4 className="text-md font-semibold text-gray-900 mb-3">
                  Dia: {discoveryResults.daily_best_patterns[selectedDay].date}
                </h4>
                
                {/* Melhor Padrão */}
                {renderPatternCard(discoveryResults.daily_best_patterns[selectedDay].best_pattern, 0, true)}
                
                {/* Padrões Alternativos */}
                {discoveryResults.daily_best_patterns[selectedDay].runner_ups.length > 0 && (
                  <div className="mt-4">
                    <h5 className="text-sm font-semibold text-gray-700 mb-2">
                      Padrões Alternativos (Top 5)
                    </h5>
                    {discoveryResults.daily_best_patterns[selectedDay].runner_ups.map((pattern, i) =>
                      renderPatternCard(pattern, i + 1)
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

