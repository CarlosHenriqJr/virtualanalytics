/**
 * Over35CompleteAnalysis.jsx - VERSÃO CORRIGIDA
 * 
 * Análise Completa com TODAS as abas incluindo Correlações e Padrões Temporais
 */

import React, { useState } from 'react';
import axios from 'axios';
import { Button } from './ui/button.jsx';
import { Input } from './ui/input.jsx';
import { Label } from './ui/label.jsx';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card.jsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs.jsx';
import { Alert, AlertDescription } from './ui/alert.jsx';
import CorrelationAnalysisTab from './analysis/CorrelationAnalysisTab.jsx';
import TemporalPatternsTab from './analysis/TemporalPatternsTab.jsx';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

export default function Over35CompleteAnalysis({ dbConnected, availableDates }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('resumo');
  
  // Parâmetros
  const [selectedDate, setSelectedDate] = useState('');
  const [specificMatchTime, setSpecificMatchTime] = useState('');
  const [selectedMarket, setSelectedMarket] = useState('TotalGols_MaisDe_35');
  
  // Para análises de Correlações e Padrões Temporais
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
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
      setActiveTab('resumo');
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
          Análise abrangente incluindo classificação, confrontos, matriz visual, cenários, correlações e padrões temporais.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label>Data Principal</Label>
            <select
              className="w-full px-3 py-2 border rounded-md"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            >
              <option value="">Selecione uma data</option>
              {availableDates && availableDates.map(date => (
                <option key={date} value={date}>{date}</option>
              ))}
            </select>
          </div>

          <div>
            <Label>Período para Correlações (Início)</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <div>
            <Label>Período para Correlações (Fim)</Label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>

        <div className="mt-4">
          <Label>Horário Específico (Opcional)</Label>
          <Input
            type="time"
            value={specificMatchTime}
            onChange={(e) => setSpecificMatchTime(e.target.value)}
            placeholder="Ex: 14:30"
          />
        </div>

        <Button 
          onClick={handleAnalyze}
          disabled={!dbConnected || loading}
          className="w-full mt-4"
        >
          {loading ? 'Analisando...' : 'Iniciar Análise Completa'}
        </Button>

        {error && (
          <Alert variant="destructive" className="mt-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </div>

      {/* Abas de Resultados */}
      {results && (
        <Card>
          <CardHeader>
            <CardTitle>Resultados da Análise</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid grid-cols-4 lg:grid-cols-8 gap-2">
                <TabsTrigger value="resumo">📊 Resumo</TabsTrigger>
                <TabsTrigger value="classificacao">🏆 Classificação</TabsTrigger>
                <TabsTrigger value="time-dia">⭐ Time do Dia</TabsTrigger>
                <TabsTrigger value="confronto">⚔️ Confronto</TabsTrigger>
                <TabsTrigger value="matriz">🎯 Matriz</TabsTrigger>
                <TabsTrigger value="cenarios">🗺️ Cenários</TabsTrigger>
                <TabsTrigger value="correlacoes">📈 Correlações</TabsTrigger>
                <TabsTrigger value="padroes-temporais">⏰ Padrões</TabsTrigger>
              </TabsList>

              {/* Aba: Resumo */}
              <TabsContent value="resumo">
                <div className="space-y-4">
                  <h3 className="text-xl font-bold">Resumo Geral</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 bg-blue-50 rounded-lg text-center">
                      <p className="text-3xl font-bold text-blue-600">
                        {results.general_stats?.total_matches || 0}
                      </p>
                      <p className="text-sm text-gray-600">Total de Jogos</p>
                    </div>
                    <div className="p-4 bg-green-50 rounded-lg text-center">
                      <p className="text-3xl font-bold text-green-600">
                        {results.general_stats?.over35_matches || 0}
                      </p>
                      <p className="text-sm text-gray-600">Over 3.5</p>
                    </div>
                    <div className="p-4 bg-purple-50 rounded-lg text-center">
                      <p className="text-3xl font-bold text-purple-600">
                        {results.general_stats?.over35_rate?.toFixed(1) || 0}%
                      </p>
                      <p className="text-sm text-gray-600">Taxa Over 3.5</p>
                    </div>
                    <div className="p-4 bg-orange-50 rounded-lg text-center">
                      <p className="text-3xl font-bold text-orange-600">
                        {results.general_stats?.avg_goals?.toFixed(1) || 0}
                      </p>
                      <p className="text-sm text-gray-600">Média de Gols</p>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Aba: Classificação */}
              <TabsContent value="classificacao">
                <div className="space-y-4">
                  <h3 className="text-xl font-bold">Tabela de Classificação</h3>
                  {results.standings && results.standings.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead className="bg-gray-100">
                          <tr>
                            <th className="p-2 text-left">Pos</th>
                            <th className="p-2 text-left">Time</th>
                            <th className="p-2 text-center">Pts</th>
                            <th className="p-2 text-center">Over 3.5%</th>
                            <th className="p-2 text-center">Jogos</th>
                          </tr>
                        </thead>
                        <tbody>
                          {results.standings.map((team, idx) => (
                            <tr key={idx} className="border-b hover:bg-gray-50">
                              <td className="p-2 font-bold">{team.position}</td>
                              <td className="p-2">{team.team_name}</td>
                              <td className="p-2 text-center">{team.points}</td>
                              <td className="p-2 text-center text-green-600 font-bold">
                                {team.over_35_rate?.toFixed(1)}%
                              </td>
                              <td className="p-2 text-center">{team.total_games}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-gray-500">Dados de classificação não disponíveis</p>
                  )}
                </div>
              </TabsContent>

              {/* Aba: Time do Dia */}
              <TabsContent value="time-dia">
                <div className="space-y-4">
                  <h3 className="text-xl font-bold">Time do Dia</h3>
                  {results.team_of_day ? (
                    <div className="p-6 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg border-2 border-yellow-400">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-2xl font-bold text-gray-900">
                          {results.team_of_day.team_name}
                        </h4>
                        <div className="text-4xl font-bold text-yellow-600">
                          {results.team_of_day.over_35_rate?.toFixed(1)}%
                        </div>
                      </div>
                      <p className="text-gray-700">{results.team_of_day.justification}</p>
                    </div>
                  ) : (
                    <p className="text-gray-500">Time do dia não identificado</p>
                  )}
                </div>
              </TabsContent>

              {/* Aba: Confronto */}
              <TabsContent value="confronto">
                <div className="space-y-4">
                  <h3 className="text-xl font-bold">Análise de Confronto</h3>
                  {results.match_analysis ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 bg-blue-50 rounded-lg">
                          <h4 className="font-bold text-lg">{results.match_analysis.team_home}</h4>
                          <p className="text-sm text-gray-600">
                            Posição: {results.match_analysis.home_position}°
                          </p>
                        </div>
                        <div className="p-4 bg-purple-50 rounded-lg">
                          <h4 className="font-bold text-lg">{results.match_analysis.team_away}</h4>
                          <p className="text-sm text-gray-600">
                            Posição: {results.match_analysis.away_position}°
                          </p>
                        </div>
                      </div>
                      <div className="p-4 bg-green-50 rounded-lg">
                        <p className="font-medium">{results.match_analysis.recommendation}</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-gray-500">Análise de confronto não disponível</p>
                  )}
                </div>
              </TabsContent>

              {/* Aba: Matriz */}
              <TabsContent value="matriz">
                <div className="space-y-4">
                  <h3 className="text-xl font-bold">Matriz Visual de Resultados</h3>
                  {results.matrix_metrics ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="p-4 bg-green-50 rounded-lg text-center">
                          <p className="text-3xl font-bold text-green-600">
                            {results.matrix_metrics.green_cells}
                          </p>
                          <p className="text-sm text-gray-600">Células Verdes</p>
                        </div>
                        <div className="p-4 bg-red-50 rounded-lg text-center">
                          <p className="text-3xl font-bold text-red-600">
                            {results.matrix_metrics.red_cells}
                          </p>
                          <p className="text-sm text-gray-600">Células Vermelhas</p>
                        </div>
                        <div className="p-4 bg-blue-50 rounded-lg text-center">
                          <p className="text-3xl font-bold text-blue-600">
                            {results.matrix_metrics.accuracy?.toFixed(1)}%
                          </p>
                          <p className="text-sm text-gray-600">Acurácia</p>
                        </div>
                        <div className="p-4 bg-purple-50 rounded-lg text-center">
                          <p className="text-3xl font-bold text-purple-600">
                            {results.matrix_metrics.largest_green_cluster}
                          </p>
                          <p className="text-sm text-gray-600">Maior Cluster</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-gray-500">Métricas de matriz não disponíveis</p>
                  )}
                </div>
              </TabsContent>

              {/* Aba: Cenários */}
              <TabsContent value="cenarios">
                <div className="space-y-4">
                  <h3 className="text-xl font-bold">Mapeamento de Cenários</h3>
                  {results.scenario_mapping ? (
                    <div className="space-y-6">
                      {results.scenario_mapping.best_hours && (
                        <div>
                          <h4 className="font-semibold mb-3">🕐 Melhores Horários</h4>
                          <div className="flex flex-wrap gap-2">
                            {results.scenario_mapping.best_hours.map((hour, i) => (
                              <span key={i} className="px-4 py-2 bg-blue-100 rounded-lg font-bold">
                                {hour}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-gray-500">Dados de cenários não disponíveis</p>
                  )}
                </div>
              </TabsContent>

              {/* Aba: Correlações - NOVA */}
              <TabsContent value="correlacoes">
                <CorrelationAnalysisTab
                  dbConnected={dbConnected}
                  availableDates={availableDates}
                  selectedMarket={selectedMarket}
                />
              </TabsContent>

              {/* Aba: Padrões Temporais - NOVA */}
              <TabsContent value="padroes-temporais">
                <TemporalPatternsTab
                  dbConnected={dbConnected}
                  availableDates={availableDates}
                  selectedMarket={selectedMarket}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}