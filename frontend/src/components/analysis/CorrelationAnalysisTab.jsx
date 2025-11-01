/**
 * CorrelationAnalysisTab.jsx - Análise de Correlações
 */

import React, { useState } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/componente./ui/card';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Alert, AlertDescription } from './ui/alert';
import { BarChart3, Calendar, Clock, Home, Trophy, TrendingUp, MapPin } from 'lucide-react';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

export default function CorrelationAnalysisTab({ dbConnected, availableDates, selectedMarket }) {
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
      
      const response = await axios.post(`${API_BASE_URL}/over35-analysis/correlation-analysis`, {
        start_date: startDate,
        end_date: endDate,
        target_market: selectedMarket || 'TotalGols_MaisDe_35'
      });
      
      setResults(response.data);
    } catch (err) {
      setError('Erro ao analisar correlações: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Configuração */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Análise de Correlações - Fatores Externos
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
            disabled={!dbConnected || loading}
            className="w-full"
          >
            {loading ? 'Analisando...' : 'Analisar Correlações'}
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
              <CardTitle>Resumo da Análise</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <p className="text-3xl font-bold text-blue-600">
                    {results.total_games}
                  </p>
                  <p className="text-sm text-gray-600">Total de Jogos</p>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <p className="text-3xl font-bold text-green-600">
                    {results.success_rate?.toFixed(1)}%
                  </p>
                  <p className="text-sm text-gray-600">Taxa de Sucesso</p>
                </div>
                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <p className="text-3xl font-bold text-purple-600">
                    {results.best_factor?.name || 'N/A'}
                  </p>
                  <p className="text-sm text-gray-600">Melhor Fator</p>
                </div>
                <div className="text-center p-4 bg-orange-50 rounded-lg">
                  <p className="text-3xl font-bold text-orange-600">
                    {results.worst_factor?.name || 'N/A'}
                  </p>
                  <p className="text-sm text-gray-600">Pior Fator</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Dia da Semana */}
          {results.day_of_week && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-blue-600" />
                  Correlação por Dia da Semana
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(results.day_of_week).sort((a, b) => b[1].success_rate - a[1].success_rate).map(([day, stats]) => (
                    <div key={day} className="flex items-center gap-4">
                      <div className="w-32 font-medium">{day}</div>
                      <div className="flex-1">
                        <div className="flex justify-between mb-1">
                          <span className="text-sm">{stats.wins}/{stats.total} jogos</span>
                          <span className="text-sm font-bold text-green-600">
                            {stats.success_rate.toFixed(1)}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-3">
                          <div
                            className="bg-blue-600 h-3 rounded-full transition-all"
                            style={{ width: `${stats.success_rate}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-gray-700">
                    <strong>Insight:</strong> {results.day_of_week_insight || 'Analise os dias com maior taxa de sucesso para identificar padrões semanais.'}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Horários */}
          {results.hourly && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-green-600" />
                  Correlação por Horário
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {Object.entries(results.hourly).sort((a, b) => b[1].success_rate - a[1].success_rate).slice(0, 12).map(([hour, stats]) => (
                    <div key={hour} className="p-3 border rounded-lg hover:shadow-md transition-shadow">
                      <div className="text-2xl font-bold text-center text-green-600">
                        {String(hour).padStart(2, '0')}h
                      </div>
                      <div className="text-center mt-2">
                        <div className="text-lg font-bold">{stats.success_rate.toFixed(1)}%</div>
                        <div className="text-xs text-gray-600">{stats.total} jogos</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 p-3 bg-green-50 rounded-lg">
                  <p className="text-sm text-gray-700">
                    <strong>Insight:</strong> {results.hourly_insight || 'Identifique os horários de pico para otimizar suas entradas.'}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Casa vs Fora */}
          {results.home_away && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Home className="w-5 h-5 text-purple-600" />
                  Correlação Casa vs Fora
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="p-6 bg-blue-50 rounded-lg">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold">Jogando em Casa</h3>
                      <Home className="w-6 h-6 text-blue-600" />
                    </div>
                    <div className="text-4xl font-bold text-blue-600 mb-2">
                      {results.home_away.home.success_rate.toFixed(1)}%
                    </div>
                    <p className="text-sm text-gray-600">
                      {results.home_away.home.wins} vitórias em {results.home_away.home.total} jogos
                    </p>
                  </div>
                  <div className="p-6 bg-purple-50 rounded-lg">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold">Jogando Fora</h3>
                      <MapPin className="w-6 h-6 text-purple-600" />
                    </div>
                    <div className="text-4xl font-bold text-purple-600 mb-2">
                      {results.home_away.away.success_rate.toFixed(1)}%
                    </div>
                    <p className="text-sm text-gray-600">
                      {results.home_away.away.wins} vitórias em {results.home_away.away.total} jogos
                    </p>
                  </div>
                </div>
                <div className="mt-4 p-3 bg-purple-50 rounded-lg">
                  <p className="text-sm text-gray-700">
                    <strong>Insight:</strong> {results.home_away_insight || 'Compare a performance em casa vs fora para identificar viés de localização.'}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Posição na Tabela */}
          {results.position_correlation && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-yellow-600" />
                  Correlação com Posição na Tabela
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 bg-yellow-50 rounded-lg text-center">
                      <p className="text-sm text-gray-600 mb-2">Times Fortes (Top 5)</p>
                      <p className="text-3xl font-bold text-yellow-600">
                        {results.position_correlation.top5.success_rate.toFixed(1)}%
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {results.position_correlation.top5.total} jogos
                      </p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg text-center">
                      <p className="text-sm text-gray-600 mb-2">Times Médios (6-15)</p>
                      <p className="text-3xl font-bold text-gray-600">
                        {results.position_correlation.mid.success_rate.toFixed(1)}%
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {results.position_correlation.mid.total} jogos
                      </p>
                    </div>
                    <div className="p-4 bg-red-50 rounded-lg text-center">
                      <p className="text-sm text-gray-600 mb-2">Times Fracos (16+)</p>
                      <p className="text-3xl font-bold text-red-600">
                        {results.position_correlation.bottom.success_rate.toFixed(1)}%
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {results.position_correlation.bottom.total} jogos
                      </p>
                    </div>
                  </div>
                  <div className="p-3 bg-yellow-50 rounded-lg">
                    <p className="text-sm text-gray-700">
                      <strong>Insight:</strong> {results.position_insight || 'Identifique se o padrão funciona melhor contra times fortes, médios ou fracos.'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Volume de Jogos */}
          {results.volume_correlation && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-indigo-600" />
                  Correlação com Volume de Jogos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(results.volume_correlation).map(([range, stats]) => (
                    <div key={range} className="flex items-center gap-4">
                      <div className="w-40 font-medium">{range} jogos/dia</div>
                      <div className="flex-1">
                        <div className="flex justify-between mb-1">
                          <span className="text-sm">{stats.total} ocorrências</span>
                          <span className="text-sm font-bold text-indigo-600">
                            {stats.success_rate.toFixed(1)}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-3">
                          <div
                            className="bg-indigo-600 h-3 rounded-full transition-all"
                            style={{ width: `${stats.success_rate}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 p-3 bg-indigo-50 rounded-lg">
                  <p className="text-sm text-gray-700">
                    <strong>Insight:</strong> {results.volume_insight || 'Verifique se dias com mais ou menos jogos afetam a performance.'}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recomendações */}
          {results.recommendations && results.recommendations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Recomendações Baseadas nas Correlações</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {results.recommendations.map((rec, idx) => (
                    <div key={idx} className="p-3 bg-green-50 rounded-lg border-l-4 border-green-600">
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