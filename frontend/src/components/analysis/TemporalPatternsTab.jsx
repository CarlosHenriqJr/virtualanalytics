/**
 * TemporalPatternsTab.jsx - Análise de Padrões Temporais
 * Versão completa e corrigida
 */

import React, { useState, useMemo } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Clock, TrendingUp, Zap, Activity, Target, Repeat } from 'lucide-react';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

export default function TemporalPatternsTab({ dbConnected, availableDates, selectedMarket }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [results, setResults] = useState(null);

  const handleAnalyze = async () => {
    if (!startDate || !endDate) {
      setError('Selecione o período de análise');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const response = await axios.post(`${API_BASE_URL}/over35-analysis/temporal-patterns`, {
        start_date: startDate,
        end_date: endDate,
        target_market: selectedMarket || 'TotalGols_MaisDe_35'
      });
      
      setResults(response.data);
    } catch (err) {
      setError('Erro ao analisar padrões temporais: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  const sequenceAnalysis = useMemo(() => {
    if (!results?.sequences) return null;
    
    const greenSequences = results.sequences.filter(s => s.type === 'green');
    const redSequences = results.sequences.filter(s => s.type === 'red');
    
    return {
      longestGreen: Math.max(...greenSequences.map(s => s.length), 0),
      longestRed: Math.max(...redSequences.map(s => s.length), 0),
      avgGreen: greenSequences.length > 0 
        ? (greenSequences.reduce((sum, s) => sum + s.length, 0) / greenSequences.length).toFixed(1)
        : 0,
      avgRed: redSequences.length > 0
        ? (redSequences.reduce((sum, s) => sum + s.length, 0) / redSequences.length).toFixed(1)
        : 0,
      totalGreenSeq: greenSequences.length,
      totalRedSeq: redSequences.length
    };
  }, [results]);

  return (
    <div className="space-y-6">
      {/* Card de Configuração */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Análise de Padrões Temporais
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <Label>Data Inicial</Label>
              <input 
                type="date" 
                className="w-full px-3 py-2 border rounded-md" 
                value={startDate} 
                onChange={(e) => setStartDate(e.target.value)} 
              />
            </div>
            <div>
              <Label>Data Final</Label>
              <input 
                type="date" 
                className="w-full px-3 py-2 border rounded-md" 
                value={endDate} 
                onChange={(e) => setEndDate(e.target.value)} 
              />
            </div>
          </div>
          
          <Button 
            onClick={handleAnalyze} 
            disabled={!dbConnected || loading || !startDate || !endDate}
            className="w-full"
          >
            {loading ? 'Analisando...' : 'Analisar Padrões Temporais'}
          </Button>

          {error && (
            <Alert variant="destructive" className="mt-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Resultados */}
      {results && (
        <div className="space-y-6">
          {/* Resumo Geral */}
          <Card>
            <CardHeader>
              <CardTitle>Resumo de Padrões Temporais</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <p className="text-3xl font-bold text-blue-600">{results.total_days}</p>
                  <p className="text-sm text-gray-600">Dias Analisados</p>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <p className="text-3xl font-bold text-green-600">{results.total_sequences}</p>
                  <p className="text-sm text-gray-600">Sequências</p>
                </div>
                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <p className="text-3xl font-bold text-purple-600">
                    {results.pattern_strength?.toFixed(0)}%
                  </p>
                  <p className="text-sm text-gray-600">Força do Padrão</p>
                </div>
                <div className="text-center p-4 bg-orange-50 rounded-lg">
                  <p className="text-3xl font-bold text-orange-600">
                    {results.consistency_score?.toFixed(0)}%
                  </p>
                  <p className="text-sm text-gray-600">Consistência</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Análise de Sequências */}
          {sequenceAnalysis && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                  Análise de Sequências (Greens & Reds)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Sequências Verdes */}
                  <div className="p-6 bg-green-50 rounded-lg border-2 border-green-200">
                    <h3 className="text-lg font-bold text-green-800 mb-4">
                      Sequências de Sucesso (Green)
                    </h3>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Mais longa:</span>
                        <span className="text-2xl font-bold text-green-600">
                          {sequenceAnalysis.longestGreen}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Média:</span>
                        <span className="text-xl font-bold text-green-600">
                          {sequenceAnalysis.avgGreen}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Total de sequências:</span>
                        <span className="text-lg font-bold text-green-600">
                          {sequenceAnalysis.totalGreenSeq}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Sequências Vermelhas */}
                  <div className="p-6 bg-red-50 rounded-lg border-2 border-red-200">
                    <h3 className="text-lg font-bold text-red-800 mb-4">
                      Sequências de Falha (Red)
                    </h3>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Mais longa:</span>
                        <span className="text-2xl font-bold text-red-600">
                          {sequenceAnalysis.longestRed}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Média:</span>
                        <span className="text-xl font-bold text-red-600">
                          {sequenceAnalysis.avgRed}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Total de sequências:</span>
                        <span className="text-lg font-bold text-red-600">
                          {sequenceAnalysis.totalRedSeq}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-gray-700">
                    <strong>Insight:</strong> {results.sequence_insight || 
                      'Sequências longas indicam períodos de alta volatilidade. Use para ajustar bankroll.'}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Padrões por Horário */}
          {results.hourly_patterns && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-blue-600" />
                  Padrões por Horário
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {results.hourly_patterns.map(pattern => (
                    <div key={pattern.hour} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                      <div className="w-20 text-center">
                        <div className="text-2xl font-bold text-blue-600">
                          {String(pattern.hour).padStart(2, '0')}h
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between mb-2">
                          <span className="text-sm text-gray-600">
                            {pattern.total_games} jogos
                          </span>
                          <span className="text-sm font-bold">
                            Taxa: {pattern.success_rate?.toFixed(1)}%
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div>
                            <span className="text-gray-500">Greens: </span>
                            <span className="font-bold text-green-600">{pattern.greens}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Reds: </span>
                            <span className="font-bold text-red-600">{pattern.reds}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Seq. Média: </span>
                            <span className="font-bold">{pattern.avg_sequence?.toFixed(1)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="w-24">
                        <div className="w-full bg-gray-200 rounded-full h-3">
                          <div
                            className={`h-3 rounded-full ${
                              pattern.success_rate >= 70 ? 'bg-green-600' :
                              pattern.success_rate >= 50 ? 'bg-yellow-600' :
                              'bg-red-600'
                            }`}
                            style={{ width: `${pattern.success_rate}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-gray-700">
                    <strong>Insight:</strong> {results.hourly_insight || 
                      'Identifique os horários com melhor consistência para otimizar entradas.'}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Blocos de Performance */}
          {results.blocks && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-yellow-600" />
                  Blocos de Performance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Blocos Quentes */}
                  {results.blocks.hot_blocks && results.blocks.hot_blocks.length > 0 && (
                    <div>
                      <h3 className="font-semibold text-green-700 mb-3">
                        🔥 Blocos Quentes (Alta Performance)
                      </h3>
                      <div className="space-y-2">
                        {results.blocks.hot_blocks.map((block, idx) => (
                          <div key={idx} className="p-3 bg-green-50 rounded-lg border-l-4 border-green-600">
                            <div className="flex justify-between items-center">
                              <div>
                                <span className="font-medium">
                                  {block.start_time} - {block.end_time}
                                </span>
                                <span className="text-sm text-gray-600 ml-2">
                                  ({block.duration} jogos)
                                </span>
                              </div>
                              <div className="text-right">
                                <div className="text-lg font-bold text-green-600">
                                  {block.success_rate?.toFixed(1)}%
                                </div>
                                <div className="text-xs text-gray-600">
                                  {block.wins}/{block.total}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Blocos Frios */}
                  {results.blocks.cold_blocks && results.blocks.cold_blocks.length > 0 && (
                    <div>
                      <h3 className="font-semibold text-red-700 mb-3">
                        ❄️ Blocos Frios (Baixa Performance)
                      </h3>
                      <div className="space-y-2">
                        {results.blocks.cold_blocks.map((block, idx) => (
                          <div key={idx} className="p-3 bg-red-50 rounded-lg border-l-4 border-red-600">
                            <div className="flex justify-between items-center">
                              <div>
                                <span className="font-medium">
                                  {block.start_time} - {block.end_time}
                                </span>
                                <span className="text-sm text-gray-600 ml-2">
                                  ({block.duration} jogos)
                                </span>
                              </div>
                              <div className="text-right">
                                <div className="text-lg font-bold text-red-600">
                                  {block.success_rate?.toFixed(1)}%
                                </div>
                                <div className="text-xs text-gray-600">
                                  {block.wins}/{block.total}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div className="mt-4 p-3 bg-yellow-50 rounded-lg">
                  <p className="text-sm text-gray-700">
                    <strong>Insight:</strong> {results.blocks_insight || 
                      'Blocos quentes e frios ajudam a identificar períodos de maior/menor confiabilidade.'}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Ciclos e Repetições */}
          {results.cycles && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Repeat className="w-5 h-5 text-purple-600" />
                  Ciclos e Padrões Repetitivos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 bg-purple-50 rounded-lg text-center">
                      <p className="text-sm text-gray-600 mb-2">
                        Intervalo Médio entre Greens
                      </p>
                      <p className="text-3xl font-bold text-purple-600">
                        {results.cycles.avg_interval_between_wins?.toFixed(1)} jogos
                      </p>
                    </div>
                    <div className="p-4 bg-indigo-50 rounded-lg text-center">
                      <p className="text-sm text-gray-600 mb-2">Padrão Mais Comum</p>
                      <p className="text-2xl font-bold text-indigo-600">
                        {results.cycles.most_common_pattern || 'N/A'}
                      </p>
                    </div>
                    <div className="p-4 bg-pink-50 rounded-lg text-center">
                      <p className="text-sm text-gray-600 mb-2">Previsibilidade</p>
                      <p className="text-3xl font-bold text-pink-600">
                        {results.cycles.predictability_score?.toFixed(0)}%
                      </p>
                    </div>
                  </div>

                  {results.cycles.detected_patterns && results.cycles.detected_patterns.length > 0 && (
                    <div>
                      <h3 className="font-semibold mb-3">Padrões Detectados</h3>
                      <div className="space-y-2">
                        {results.cycles.detected_patterns.map((pattern, idx) => (
                          <div key={idx} className="p-3 bg-gray-50 rounded-lg flex justify-between items-center">
                            <div>
                              <span className="font-mono font-bold">{pattern.sequence}</span>
                              <span className="text-sm text-gray-600 ml-2">
                                (repetiu {pattern.occurrences}x)
                              </span>
                            </div>
                            <span className="text-sm font-bold text-purple-600">
                              {pattern.success_after?.toFixed(1)}% de acerto após
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div className="mt-4 p-3 bg-purple-50 rounded-lg">
                  <p className="text-sm text-gray-700">
                    <strong>Insight:</strong> {results.cycles_insight || 
                      'Padrões cíclicos podem indicar momentos ideais para entrada ou saída.'}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Volatilidade Temporal */}
          {results.volatility && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-orange-600" />
                  Volatilidade Temporal
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="p-6 bg-orange-50 rounded-lg">
                    <h3 className="font-semibold text-orange-800 mb-4">
                      Períodos de Alta Volatilidade
                    </h3>
                    <div className="space-y-2">
                      {results.volatility.high_volatility_periods?.map((period, idx) => (
                        <div key={idx} className="text-sm">
                          <span className="font-medium">{period.time_range}</span>
                          <span className="text-gray-600 ml-2">
                            (σ = {period.std_deviation?.toFixed(2)})
                          </span>
                        </div>
                      )) || <p className="text-sm text-gray-600">Nenhum período detectado</p>}
                    </div>
                  </div>
                  
                  <div className="p-6 bg-blue-50 rounded-lg">
                    <h3 className="font-semibold text-blue-800 mb-4">
                      Períodos de Baixa Volatilidade
                    </h3>
                    <div className="space-y-2">
                      {results.volatility.low_volatility_periods?.map((period, idx) => (
                        <div key={idx} className="text-sm">
                          <span className="font-medium">{period.time_range}</span>
                          <span className="text-gray-600 ml-2">
                            (σ = {period.std_deviation?.toFixed(2)})
                          </span>
                        </div>
                      )) || <p className="text-sm text-gray-600">Nenhum período detectado</p>}
                    </div>
                  </div>
                </div>
                <div className="mt-4 p-3 bg-orange-50 rounded-lg">
                  <p className="text-sm text-gray-700">
                    <strong>Insight:</strong> {results.volatility_insight || 
                      'Ajuste o tamanho das apostas baseado na volatilidade do período.'}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recomendações */}
          {results.recommendations && results.recommendations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Recomendações Baseadas em Padrões Temporais</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {results.recommendations.map((rec, idx) => (
                    <div key={idx} className="p-3 bg-blue-50 rounded-lg border-l-4 border-blue-600">
                      <p className="text-sm text-gray-700">{rec}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}