/**
 * Over35CompleteAnalysis.jsx - Análise Completa Focada em Over 3.5
 * 
 * Tela completa com:
 * 1. Tabela de Classificação
 * 2. Time do Dia
 * 3. Análise de Confronto
 * 4. Matriz Visual de Resultados
 * 5. Mapeamento de Cenários
 */

import React, { useState } from 'react';
import axios from 'axios';
import { Button } from './ui/button.jsx';
import { Input } from './ui/input.jsx';
import { Label } from './ui/label.jsx';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card.jsx';
import { Alert, AlertDescription } from './ui/alert.jsx';


const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

export default function Over35CompleteAnalysis({ dbConnected, availableDates }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Parâmetros
  const [selectedDate, setSelectedDate] = useState('');
  const [specificMatchTime, setSpecificMatchTime] = useState('');
  
  // Resultados
  const [results, setResults] = useState(null);

  const handleAnalyze = async () => {
    if (!selectedDate) {
      setError('Selecione uma data');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const response = await axios.post(`${API_BASE_URL}/over35-analysis/complete-analysis`, {
        date: selectedDate,
        specific_match_time: specificMatchTime || null
      });
      
      setResults(response.data);
    } catch (err) {
      setError('Erro ao analisar: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Painel de Configuração */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          ⚽ Análise Completa - Over 3.5 Gols
        </h2>
        
        <p className="text-sm text-gray-700 mb-4">
          Análise abrangente incluindo classificação, time do dia, confrontos, matriz visual e cenários.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Data *
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              min={availableDates?.oldest}
              max={availableDates?.newest}
              disabled={!dbConnected || loading}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-100"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Horário Específico (opcional)
            </label>
            <input
              type="time"
              value={specificMatchTime}
              onChange={(e) => setSpecificMatchTime(e.target.value)}
              disabled={!dbConnected || loading}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-100"
              placeholder="HH:MM"
            />
            <p className="text-xs text-gray-500 mt-1">Para análise H2H</p>
          </div>
          
          <div className="flex items-end">
            <button
              onClick={handleAnalyze}
              disabled={!dbConnected || loading}
              className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
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
        <div className="space-y-6">
          {/* Insights e Recomendações */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Insights */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">💡 Insights</h3>
              <ul className="space-y-2">
                {results.insights.map((insight, i) => (
                  <li key={i} className="text-sm text-gray-700">• {insight}</li>
                ))}
              </ul>
            </div>
            
            {/* Recomendações */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">📌 Recomendações</h3>
              <ul className="space-y-2">
                {results.recommendations.map((rec, i) => (
                  <li key={i} className="text-sm text-gray-700">{rec}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* Time do Dia */}
          {results.team_of_the_day && (
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4">🏆 Time do Dia</h3>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <p className="text-sm text-gray-600">Time</p>
                  <p className="text-lg font-bold text-gray-900">{results.team_of_the_day.team_name}</p>
                </div>
                
                <div>
                  <p className="text-sm text-gray-600">Taxa Over 3.5</p>
                  <p className="text-2xl font-bold text-green-600">{results.team_of_the_day.over35_rate.toFixed(1)}%</p>
                </div>
                
                <div>
                  <p className="text-sm text-gray-600">Forma Recente</p>
                  <p className="text-lg font-bold text-gray-900">{results.team_of_the_day.recent_form}</p>
                </div>
                
                <div>
                  <p className="text-sm text-gray-600">Jogos Over 3.5</p>
                  <p className="text-2xl font-bold text-blue-600">{results.team_of_the_day.recent_over35_games}</p>
                </div>
              </div>
              
              <div className="pt-4 border-t border-purple-200">
                <p className="text-sm text-gray-700">{results.team_of_the_day.justification}</p>
              </div>
            </div>
          )}

          {/* Análise de Confronto */}
          {results.match_analysis && (
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4">⚔️ Análise de Confronto - {results.match_analysis.match_time}</h3>
              
              <div className="grid grid-cols-2 gap-6 mb-6">
                {/* Time Casa */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="text-lg font-semibold text-gray-900 mb-3">{results.match_analysis.team_home} (Casa)</h4>
                  <div className="space-y-2">
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">Posição:</span> {results.match_analysis.team_home_position}º
                    </p>
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">Over 3.5:</span> {results.match_analysis.team_home_over35_count} jogos
                    </p>
                  </div>
                </div>
                
                {/* Time Fora */}
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <h4 className="text-lg font-semibold text-gray-900 mb-3">{results.match_analysis.team_away} (Fora)</h4>
                  <div className="space-y-2">
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">Posição:</span> {results.match_analysis.team_away_position}º
                    </p>
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">Over 3.5:</span> {results.match_analysis.team_away_over35_count} jogos
                    </p>
                  </div>
                </div>
              </div>
              
              {/* H2H */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
                <h4 className="text-md font-semibold text-gray-900 mb-3">📊 Histórico (H2H)</h4>
                
                <div className="grid grid-cols-3 md:grid-cols-6 gap-4 mb-4">
                  <div>
                    <p className="text-xs text-gray-600">Total</p>
                    <p className="text-lg font-bold text-gray-900">{results.match_analysis.head_to_head.total_matches}</p>
                  </div>
                  
                  <div>
                    <p className="text-xs text-gray-600">Vitórias {results.match_analysis.team_home}</p>
                    <p className="text-lg font-bold text-blue-600">{results.match_analysis.head_to_head.team1_wins}</p>
                  </div>
                  
                  <div>
                    <p className="text-xs text-gray-600">Empates</p>
                    <p className="text-lg font-bold text-gray-600">{results.match_analysis.head_to_head.draws}</p>
                  </div>
                  
                  <div>
                    <p className="text-xs text-gray-600">Vitórias {results.match_analysis.team_away}</p>
                    <p className="text-lg font-bold text-red-600">{results.match_analysis.head_to_head.team2_wins}</p>
                  </div>
                  
                  <div>
                    <p className="text-xs text-gray-600">Over 3.5</p>
                    <p className="text-lg font-bold text-green-600">{results.match_analysis.head_to_head.over35_matches}</p>
                  </div>
                  
                  <div>
                    <p className="text-xs text-gray-600">Taxa Over</p>
                    <p className="text-lg font-bold text-green-600">{results.match_analysis.head_to_head.over35_rate.toFixed(1)}%</p>
                  </div>
                </div>
                
                {results.match_analysis.head_to_head.common_scores.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">Placares Comuns:</p>
                    <div className="flex gap-2">
                      {results.match_analysis.head_to_head.common_scores.map((score, i) => (
                        <span key={i} className="px-3 py-1 bg-white border border-gray-300 rounded text-sm font-semibold text-gray-900">
                          {score}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-sm font-medium text-gray-900">{results.match_analysis.recommendation}</p>
              </div>
            </div>
          )}

          {/* Tabela de Classificação */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">🏅 Tabela de Classificação</h3>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pos</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                    <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Pts</th>
                    <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">SG</th>
                    <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">V</th>
                    <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">E</th>
                    <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">D</th>
                    <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">VC</th>
                    <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">VF</th>
                    <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Over 3.5</th>
                    <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Taxa</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {results.standings.slice(0, 20).map((team, i) => (
                    <tr key={i} className={i < 3 ? 'bg-green-50' : i >= results.standings.length - 3 ? 'bg-red-50' : ''}>
                      <td className="px-3 py-3 whitespace-nowrap text-sm font-bold text-gray-900">{team.position}</td>
                      <td className="px-3 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{team.team_name}</td>
                      <td className="px-3 py-3 whitespace-nowrap text-sm text-center font-bold text-gray-900">{team.points}</td>
                      <td className="px-3 py-3 whitespace-nowrap text-sm text-center text-gray-700">{team.goal_difference > 0 ? '+' : ''}{team.goal_difference}</td>
                      <td className="px-3 py-3 whitespace-nowrap text-sm text-center text-gray-700">{team.total_wins}</td>
                      <td className="px-3 py-3 whitespace-nowrap text-sm text-center text-gray-700">{team.total_draws}</td>
                      <td className="px-3 py-3 whitespace-nowrap text-sm text-center text-gray-700">{team.total_losses}</td>
                      <td className="px-3 py-3 whitespace-nowrap text-sm text-center text-gray-700">{team.home_wins}</td>
                      <td className="px-3 py-3 whitespace-nowrap text-sm text-center text-gray-700">{team.away_wins}</td>
                      <td className="px-3 py-3 whitespace-nowrap text-sm text-center font-semibold text-green-600">{team.over35_count}</td>
                      <td className="px-3 py-3 whitespace-nowrap text-sm text-center font-bold text-green-600">{team.over35_rate.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {results.standings.length > 20 && (
              <p className="text-xs text-gray-500 mt-3 text-center">
                Mostrando top 20 de {results.standings.length} times
              </p>
            )}
          </div>

          {/* Matriz Visual */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">🎯 Matriz Visual de Resultados</h3>
            
            {/* Métricas */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <p className="text-xs text-gray-600">Total de Jogos</p>
                <p className="text-2xl font-bold text-gray-900">{results.matrix_analysis.total_cells}</p>
              </div>
              
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-xs text-gray-600">Over 3.5 ✅</p>
                <p className="text-2xl font-bold text-green-600">{results.matrix_analysis.green_cells}</p>
              </div>
              
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-xs text-gray-600">Under 3.5 ❌</p>
                <p className="text-2xl font-bold text-red-600">{results.matrix_analysis.red_cells}</p>
              </div>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs text-gray-600">Taxa de Acerto</p>
                <p className="text-2xl font-bold text-blue-600">{results.matrix_analysis.accuracy.toFixed(1)}%</p>
              </div>
              
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                <p className="text-xs text-gray-600">Maior Cluster</p>
                <p className="text-2xl font-bold text-purple-600">{results.matrix_analysis.largest_green_cluster}</p>
              </div>
            </div>
            
            {/* Resumo de Padrões */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
              <p className="text-sm font-medium text-gray-700 mb-2">📊 Resumo de Padrões:</p>
              <p className="text-sm text-gray-700">{results.matrix_analysis.pattern_summary}</p>
            </div>
            
            {/* Clusters */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Clusters Horizontais */}
              <div>
                <h4 className="text-md font-semibold text-gray-900 mb-3">
                  ➡️ Clusters Horizontais ({results.matrix_analysis.horizontal_clusters.length})
                </h4>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {results.matrix_analysis.horizontal_clusters.slice(0, 10).map((cluster, i) => (
                    <div key={i} className="bg-green-50 border border-green-200 rounded p-2">
                      <p className="text-xs font-semibold text-gray-900">
                        Cluster #{i+1} - Tamanho: {cluster.size}
                      </p>
                      <p className="text-xs text-gray-600">
                        Linha {cluster.start_row}, Colunas {cluster.start_col} a {cluster.end_col}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Clusters Verticais */}
              <div>
                <h4 className="text-md font-semibold text-gray-900 mb-3">
                  ⬇️ Clusters Verticais ({results.matrix_analysis.vertical_clusters.length})
                </h4>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {results.matrix_analysis.vertical_clusters.slice(0, 10).map((cluster, i) => (
                    <div key={i} className="bg-blue-50 border border-blue-200 rounded p-2">
                      <p className="text-xs font-semibold text-gray-900">
                        Cluster #{i+1} - Tamanho: {cluster.size}
                      </p>
                      <p className="text-xs text-gray-600">
                        Coluna {cluster.start_col}, Linhas {cluster.start_row} a {cluster.end_row}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Mapeamento de Cenários */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">🗺️ Mapeamento de Cenários</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* ODDs Favoráveis */}
              <div>
                <h4 className="text-md font-semibold text-gray-900 mb-3">💰 ODDs Favoráveis</h4>
                <div className="space-y-2">
                  {results.scenario_mapping.favorable_odds.slice(0, 5).map((odd, i) => (
                    <div key={i} className="bg-green-50 border border-green-200 rounded p-3">
                      <div className="flex justify-between items-center">
                        <span className="text-lg font-bold text-gray-900">{odd.odd.toFixed(2)}</span>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-green-600">{odd.percentage.toFixed(1)}%</p>
                          <p className="text-xs text-gray-600">{odd.count} vezes</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Placares Comuns */}
              <div>
                <h4 className="text-md font-semibold text-gray-900 mb-3">⚽ Placares Comuns</h4>
                <div className="space-y-2">
                  {results.scenario_mapping.common_scores.slice(0, 5).map((score, i) => (
                    <div key={i} className="bg-blue-50 border border-blue-200 rounded p-3">
                      <div className="flex justify-between items-center">
                        <span className="text-lg font-bold text-gray-900">{score.score}</span>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-blue-600">{score.percentage.toFixed(1)}%</p>
                          <p className="text-xs text-gray-600">{score.count} vezes</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            {/* Horários de Pico */}
            {results.scenario_mapping.peak_hours.length > 0 && (
              <div className="mt-6">
                <h4 className="text-md font-semibold text-gray-900 mb-3">🕐 Horários de Pico</h4>
                <div className="flex flex-wrap gap-2">
                  {results.scenario_mapping.peak_hours.map((hour, i) => (
                    <span key={i} className="px-4 py-2 bg-purple-100 border border-purple-300 rounded-lg text-sm font-bold text-purple-900">
                      {hour}:00
                    </span>
                  ))}
                </div>
              </div>
            )}
            
            {/* Sequências */}
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Sucesso */}
              {results.scenario_mapping.success_sequences.length > 0 && (
                <div>
                  <h4 className="text-md font-semibold text-gray-900 mb-3">✅ Sequências de Sucesso</h4>
                  <div className="space-y-2">
                    {results.scenario_mapping.success_sequences.map((seq, i) => (
                      <div key={i} className="bg-green-50 border border-green-200 rounded p-2">
                        <p className="text-xs text-gray-700">{seq.length} jogos consecutivos com Over 3.5</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Fracasso */}
              {results.scenario_mapping.failure_sequences.length > 0 && (
                <div>
                  <h4 className="text-md font-semibold text-gray-900 mb-3">❌ Sequências de Fracasso</h4>
                  <div className="space-y-2">
                    {results.scenario_mapping.failure_sequences.map((seq, i) => (
                      <div key={i} className="bg-red-50 border border-red-200 rounded p-2">
                        <p className="text-xs text-gray-700">{seq.length} jogos consecutivos sem Over 3.5</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}