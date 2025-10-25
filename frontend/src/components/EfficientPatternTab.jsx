/**
 * EfficientPatternTab.jsx - Análise Eficiente de Padrões
 * 
 * Mostra a frequência de TODOS os mercados nos jogos anteriores
 * a cada ocorrência do mercado-alvo.
 */

import React, { useState } from 'react';
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

export default function EfficientPatternTab({
  selectedMarket,
  dbConnected,
  availableDates
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Parâmetros
  const [referenceDate, setReferenceDate] = useState('');
  const [lookbackGames, setLookbackGames] = useState(20);
  
  // Resultados
  const [results, setResults] = useState(null);
  const [selectedOccurrence, setSelectedOccurrence] = useState(null);

  const handleAnalyze = async () => {
    if (!selectedMarket) {
      setError('Selecione um mercado primeiro');
      return;
    }

    if (!referenceDate) {
      setError('Selecione uma data de referência');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const response = await axios.post(`${API_BASE_URL}/efficient-pattern/analyze`, {
        target_market: selectedMarket,
        reference_date: referenceDate,
        lookback_games: parseInt(lookbackGames)
      });
      
      setResults(response.data);
      setSelectedOccurrence(null);
    } catch (err) {
      setError('Erro ao analisar padrões: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  const renderMarketFrequency = (mf, index) => {
    const bgColor = mf.result === 'green' ? 'bg-green-50' : 
                    mf.result === 'red' ? 'bg-red-50' : 
                    mf.result === 'both' ? 'bg-yellow-50' : 'bg-gray-50';
    
    const badgeColor = mf.result === 'green' ? 'bg-green-500' : 
                       mf.result === 'red' ? 'bg-red-500' : 
                       mf.result === 'both' ? 'bg-yellow-500' : 'bg-gray-500';
    
    return (
      <div key={index} className={`${bgColor} border border-gray-200 rounded-lg p-3 mb-2`}>
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-900">{mf.market_name}</p>
            <p className="text-xs text-gray-600 mt-1">
              Odd: <span className="font-bold">{mf.odd.toFixed(2)}</span>
            </p>
          </div>
          
          <div className="text-right">
            <p className="text-lg font-bold text-gray-900">{mf.percentage.toFixed(1)}%</p>
            <p className="text-xs text-gray-600">{mf.frequency} / {mf.total_games} jogos</p>
            <span className={`inline-block mt-1 ${badgeColor} text-white text-xs px-2 py-1 rounded`}>
              {mf.result === 'green' ? '✓ Sempre ganhou' : 
               mf.result === 'red' ? '✗ Sempre perdeu' : 
               mf.result === 'both' ? '± Misto' : '?'}
            </span>
          </div>
        </div>
      </div>
    );
  };

  const renderGameBefore = (game, index) => {
    return (
      <div key={index} className="bg-white border border-gray-200 rounded p-2 mb-2">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-xs font-semibold text-gray-900">{game.time}</p>
            <p className="text-xs text-gray-600">{game.teams}</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold text-gray-900">{game.score_ft}</p>
            <p className="text-xs text-gray-500">HT: {game.score_ht}</p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div>
      {/* Painel de Configuração */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          📊 Análise Eficiente de Padrões
        </h3>
        
        <p className="text-sm text-gray-700 mb-4">
          Isola um mercado-alvo e analisa TODOS os mercados dos jogos anteriores,
          mostrando a frequência de aparição de cada um.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Data de Referência
            </label>
            <input
              type="date"
              value={referenceDate}
              onChange={(e) => setReferenceDate(e.target.value)}
              min={availableDates?.oldest}
              max={availableDates?.newest}
              disabled={!dbConnected || loading}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Jogos Anteriores (Lookback)
            </label>
            <input
              type="number"
              value={lookbackGames}
              onChange={(e) => setLookbackGames(e.target.value)}
              min="1"
              max="100"
              disabled={!dbConnected || loading}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            />
          </div>
          
          <div className="flex items-end">
            <button
              onClick={handleAnalyze}
              disabled={!dbConnected || loading || !selectedMarket}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {loading ? 'Analisando...' : '🔍 Analisar'}
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
      {results && (
        <div>
          {/* Resumo */}
          <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              📈 Resumo da Análise
            </h3>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div>
                <p className="text-sm text-gray-600">Data</p>
                <p className="text-lg font-semibold text-gray-900">{results.date}</p>
              </div>
              
              <div>
                <p className="text-sm text-gray-600">Mercado-alvo</p>
                <p className="text-sm font-semibold text-gray-900">{results.target_market}</p>
                {results.target_market_odd && (
                  <p className="text-xs text-gray-500">Odd: {results.target_market_odd.toFixed(2)}</p>
                )}
              </div>
              
              <div>
                <p className="text-sm text-gray-600">Ocorrências</p>
                <p className="text-2xl font-bold text-blue-600">{results.total_occurrences}</p>
              </div>
              
              <div>
                <p className="text-sm text-gray-600">Total de Jogos</p>
                <p className="text-2xl font-bold text-gray-900">{results.total_games_analyzed}</p>
              </div>
            </div>
            
            <div className="pt-4 border-t border-gray-200">
              <p className="text-sm font-semibold text-gray-700 mb-2">💡 Resumo</p>
              <p className="text-sm text-gray-700">{results.summary}</p>
            </div>
            
            {results.recommendations.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-sm font-semibold text-gray-700 mb-2">📌 Observações</p>
                <ul className="space-y-1">
                  {results.recommendations.map((rec, i) => (
                    <li key={i} className="text-sm text-gray-700">• {rec}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Frequências Agregadas */}
          <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              📊 Frequências Agregadas (Todos os Jogos Anteriores)
            </h3>
            
            <p className="text-sm text-gray-600 mb-4">
              Estatísticas considerando TODOS os jogos anteriores de TODAS as {results.total_occurrences} ocorrências do mercado-alvo.
            </p>
            
            <div className="max-h-96 overflow-y-auto">
              {results.aggregated_market_frequencies.slice(0, 50).map((mf, i) => 
                renderMarketFrequency(mf, i)
              )}
            </div>
            
            {results.aggregated_market_frequencies.length > 50 && (
              <p className="text-xs text-gray-500 mt-2 text-center">
                Mostrando top 50 de {results.aggregated_market_frequencies.length} mercados
              </p>
            )}
          </div>

          {/* Detalhes por Ocorrência */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              🔍 Detalhes por Ocorrência
            </h3>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Selecione uma ocorrência para ver detalhes
              </label>
              <select
                value={selectedOccurrence !== null ? selectedOccurrence : ''}
                onChange={(e) => setSelectedOccurrence(e.target.value ? parseInt(e.target.value) : null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Selecione uma ocorrência --</option>
                {results.occurrence_details.map((occ, i) => (
                  <option key={i} value={i}>
                    Ocorrência #{occ.occurrence_index} - {occ.target_game_time} - {occ.target_game_teams}
                  </option>
                ))}
              </select>
            </div>
            
            {selectedOccurrence !== null && results.occurrence_details[selectedOccurrence] && (
              <div>
                {(() => {
                  const occ = results.occurrence_details[selectedOccurrence];
                  return (
                    <div>
                      {/* Info do Jogo Alvo */}
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                        <p className="text-sm font-semibold text-gray-700 mb-2">
                          🎯 Jogo onde {results.target_market} ocorreu:
                        </p>
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <p className="text-xs text-gray-600">Horário</p>
                            <p className="text-sm font-bold text-gray-900">{occ.target_game_time}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-600">Times</p>
                            <p className="text-sm font-bold text-gray-900">{occ.target_game_teams}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-600">Placar FT</p>
                            <p className="text-sm font-bold text-gray-900">{occ.target_game_score}</p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* Jogos Anteriores */}
                        <div>
                          <h4 className="text-md font-semibold text-gray-900 mb-3">
                            📅 {occ.games_before.length} Jogos Anteriores
                          </h4>
                          <div className="max-h-96 overflow-y-auto">
                            {occ.games_before.map((game, i) => renderGameBefore(game, i))}
                          </div>
                        </div>
                        
                        {/* Frequências dos Mercados */}
                        <div>
                          <h4 className="text-md font-semibold text-gray-900 mb-3">
                            📊 Frequências dos Mercados (Top 20)
                          </h4>
                          <div className="max-h-96 overflow-y-auto">
                            {occ.market_frequencies.slice(0, 20).map((mf, i) => 
                              renderMarketFrequency(mf, i)
                            )}
                          </div>
                          {occ.market_frequencies.length > 20 && (
                            <p className="text-xs text-gray-500 mt-2 text-center">
                              Mostrando top 20 de {occ.market_frequencies.length} mercados
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

