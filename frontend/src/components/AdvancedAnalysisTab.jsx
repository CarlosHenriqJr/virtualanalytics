import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Alert, AlertDescription } from './ui/alert';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { Trophy, TrendingUp, Target, Grid, Map, AlertTriangle, CheckCircle2, Award, Calendar } from 'lucide-react';

const AdvancedAnalysisTab = () => {
  const [startDate, setStartDate] = useState('2025-01-01');
  const [endDate, setEndDate] = useState('2025-01-10');
  const [targetMarket, setTargetMarket] = useState('TotalGols_MaisDe_35');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  const handleAnalysis = async () => {
    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const response = await fetch('http://localhost:8000/advanced-analysis/full-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          start_date: startDate,
          end_date: endDate,
          target_market: targetMarket,
        }),
      });

      if (!response.ok) {
        throw new Error('Erro ao executar análise');
      }

      const data = await response.json();
      setResults(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getAccuracyColor = (accuracy) => {
    if (accuracy >= 70) return 'text-green-600';
    if (accuracy >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="space-y-6">
      {/* Configuration Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Grid className="h-5 w-5 text-blue-600" />
            <CardTitle>Análise Avançada de Futebol Virtual</CardTitle>
          </div>
          <CardDescription>
            Análise completa com classificação, times do dia, confrontos, matriz de padrões e cenários
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="start-date">Data Inicial</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="end-date">Data Final</Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="target-market">Mercado-Alvo</Label>
              <Select value={targetMarket} onValueChange={setTargetMarket}>
                <SelectTrigger id="target-market">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TotalGols_MaisDe_35">Over 3.5 Gols</SelectItem>
                  <SelectItem value="TotalGols_MaisDe_25">Over 2.5 Gols</SelectItem>
                  <SelectItem value="AmbasMarcam_Sim">Ambas Marcam</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            onClick={handleAnalysis}
            disabled={loading}
            className="w-full mt-4"
          >
            {loading ? 'Analisando...' : 'Iniciar Análise Avançada'}
          </Button>
        </CardContent>
      </Card>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Results */}
      {results && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <Trophy className="h-8 w-8 mx-auto text-yellow-600 mb-2" />
                  <div className="text-2xl font-bold">{results.standings.length}</div>
                  <div className="text-sm text-gray-600">Times Analisados</div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <Target className="h-8 w-8 mx-auto text-blue-600 mb-2" />
                  <div className={`text-2xl font-bold ${getAccuracyColor(results.matrix_metrics.accuracy)}`}>
                    {results.matrix_metrics.accuracy.toFixed(1)}%
                  </div>
                  <div className="text-sm text-gray-600">Acurácia Geral</div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <Grid className="h-8 w-8 mx-auto text-green-600 mb-2" />
                  <div className="text-2xl font-bold text-green-600">
                    {results.matrix_metrics.largest_green_cluster}
                  </div>
                  <div className="text-sm text-gray-600">Maior Cluster</div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <Calendar className="h-8 w-8 mx-auto text-purple-600 mb-2" />
                  <div className="text-2xl font-bold text-purple-600">
                    {results.teams_of_day.length}
                  </div>
                  <div className="text-sm text-gray-600">Dias Analisados</div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tabs for detailed results */}
          <Tabs defaultValue="standings" className="w-full">
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="standings">🏆 Classificação</TabsTrigger>
              <TabsTrigger value="teams-of-day">⭐ Time do Dia</TabsTrigger>
              <TabsTrigger value="matchups">🎯 Confrontos</TabsTrigger>
              <TabsTrigger value="matrix">📊 Matriz</TabsTrigger>
              <TabsTrigger value="scenarios">🗺️ Cenários</TabsTrigger>
              <TabsTrigger value="insights">💡 Insights</TabsTrigger>
            </TabsList>

            {/* Standings Tab */}
            <TabsContent value="standings">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-yellow-600" />
                    Tabela de Classificação
                  </CardTitle>
                  <CardDescription>
                    Classificação completa dos times com taxa de Over 3.5
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2">#</th>
                          <th className="text-left p-2">Time</th>
                          <th className="text-center p-2">Pts</th>
                          <th className="text-center p-2">SG</th>
                          <th className="text-center p-2">V</th>
                          <th className="text-center p-2">E</th>
                          <th className="text-center p-2">D</th>
                          <th className="text-center p-2">VC</th>
                          <th className="text-center p-2">VF</th>
                          <th className="text-center p-2">Over 3.5</th>
                          <th className="text-center p-2">Taxa</th>
                        </tr>
                      </thead>
                      <tbody>
                        {results.standings.map((team, index) => (
                          <tr key={index} className="border-b hover:bg-gray-50">
                            <td className="p-2 font-semibold">{team.position}</td>
                            <td className="p-2">{team.team_name}</td>
                            <td className="text-center p-2 font-semibold">{team.points}</td>
                            <td className="text-center p-2">{team.goal_difference}</td>
                            <td className="text-center p-2">{team.total_wins}</td>
                            <td className="text-center p-2">{team.total_draws}</td>
                            <td className="text-center p-2">{team.total_losses}</td>
                            <td className="text-center p-2">{team.home_wins}</td>
                            <td className="text-center p-2">{team.away_wins}</td>
                            <td className="text-center p-2">{team.over_35_games}/{team.total_games}</td>
                            <td className="text-center p-2">
                              <Badge className={team.over_35_rate >= 60 ? 'bg-green-600' : team.over_35_rate >= 40 ? 'bg-yellow-600' : 'bg-red-600'}>
                                {team.over_35_rate.toFixed(1)}%
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Teams of Day Tab */}
            <TabsContent value="teams-of-day">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Award className="h-5 w-5 text-yellow-600" />
                    Time do Dia
                  </CardTitle>
                  <CardDescription>
                    Times com maior viés para Over 3.5 em cada dia
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {results.teams_of_day.map((team, index) => (
                      <div key={index} className="p-4 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg border-l-4 border-yellow-600">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <div className="font-semibold text-lg">{team.team_name}</div>
                            <div className="text-sm text-gray-600">{team.date}</div>
                          </div>
                          <Badge className="bg-yellow-600 text-lg px-4 py-2">
                            {team.over_35_rate.toFixed(1)}%
                          </Badge>
                        </div>
                        <div className="text-sm text-gray-700 mb-2">
                          {team.justification}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-gray-600">Forma recente:</span>
                          <div className="flex gap-1">
                            {team.recent_form.map((result, i) => (
                              <span
                                key={i}
                                className={`px-2 py-1 rounded text-xs font-semibold ${
                                  result === 'W' ? 'bg-green-600 text-white' :
                                  result === 'L' ? 'bg-red-600 text-white' :
                                  'bg-gray-400 text-white'
                                }`}
                              >
                                {result}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Matchups Tab */}
            <TabsContent value="matchups">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-blue-600" />
                    Análise de Confrontos
                  </CardTitle>
                  <CardDescription>
                    Confrontos específicos com potencial para Over 3.5
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {results.matchup_analyses.slice(0, 10).map((matchup, index) => (
                      <div key={index} className="p-4 bg-gray-50 rounded-lg border">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex-1">
                            <div className="font-semibold text-lg">
                              {matchup.home_team} vs {matchup.away_team}
                            </div>
                            <div className="text-sm text-gray-600">
                              Horário: {matchup.match_time}
                            </div>
                          </div>
                          <Badge className={matchup.confidence >= 60 ? 'bg-green-600' : matchup.confidence >= 40 ? 'bg-yellow-600' : 'bg-red-600'}>
                            {matchup.confidence.toFixed(1)}%
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 mb-3">
                          <div className="text-sm">
                            <div className="font-medium text-gray-700">Casa</div>
                            <div className="text-gray-600">Posição: {matchup.home_position}º</div>
                            <div className="text-gray-600">Over 3.5: {matchup.home_over_35_season}</div>
                            <div className="text-gray-600">Força: {matchup.home_strength}</div>
                          </div>
                          <div className="text-sm">
                            <div className="font-medium text-gray-700">Fora</div>
                            <div className="text-gray-600">Posição: {matchup.away_position}º</div>
                            <div className="text-gray-600">Over 3.5: {matchup.away_over_35_season}</div>
                            <div className="text-gray-600">Força: {matchup.away_strength}</div>
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between text-sm">
                          <div className="text-gray-600">
                            H2H: {matchup.h2h_over_35}/{matchup.h2h_total} Over 3.5
                          </div>
                          <div className="font-semibold text-blue-600">
                            {matchup.prediction}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Matrix Tab */}
            <TabsContent value="matrix">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Grid className="h-5 w-5 text-green-600" />
                    Padrões Visuais (Matriz)
                  </CardTitle>
                  <CardDescription>
                    Análise de clusters e padrões temporais
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {/* Métricas Gerais */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="p-3 bg-green-50 rounded-lg text-center">
                        <div className="text-2xl font-bold text-green-600">
                          {results.matrix_metrics.green_cells}
                        </div>
                        <div className="text-xs text-gray-600">Células Verdes</div>
                      </div>
                      <div className="p-3 bg-red-50 rounded-lg text-center">
                        <div className="text-2xl font-bold text-red-600">
                          {results.matrix_metrics.red_cells}
                        </div>
                        <div className="text-xs text-gray-600">Células Vermelhas</div>
                      </div>
                      <div className="p-3 bg-blue-50 rounded-lg text-center">
                        <div className="text-2xl font-bold text-blue-600">
                          {results.matrix_metrics.largest_green_cluster}
                        </div>
                        <div className="text-xs text-gray-600">Maior Cluster</div>
                      </div>
                      <div className="p-3 bg-purple-50 rounded-lg text-center">
                        <div className="text-2xl font-bold text-purple-600">
                          {results.matrix_metrics.average_cluster_size.toFixed(1)}
                        </div>
                        <div className="text-xs text-gray-600">Cluster Médio</div>
                      </div>
                    </div>

                    {/* Acurácia */}
                    <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold">Acurácia Geral</span>
                        <span className={`text-2xl font-bold ${getAccuracyColor(results.matrix_metrics.accuracy)}`}>
                          {results.matrix_metrics.accuracy.toFixed(1)}%
                        </span>
                      </div>
                      <Progress value={results.matrix_metrics.accuracy} className="h-2" />
                    </div>

                    {/* Resumo dos Padrões */}
                    <div className="p-4 bg-yellow-50 rounded-lg border-l-4 border-yellow-600">
                      <h3 className="font-semibold text-yellow-900 mb-2">Resumo dos Padrões</h3>
                      <p className="text-sm text-gray-700">{results.matrix_metrics.pattern_summary}</p>
                    </div>

                    {/* Horários Mais Quentes */}
                    <div>
                      <h3 className="font-semibold mb-3">🔥 Horários Mais Quentes</h3>
                      <div className="flex flex-wrap gap-2">
                        {results.matrix_metrics.hottest_rows.map((hour, index) => (
                          <Badge key={index} className="bg-red-600 text-lg px-4 py-2">
                            {hour}:00
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* Minutos Mais Quentes */}
                    <div>
                      <h3 className="font-semibold mb-3">🔥 Minutos Mais Quentes</h3>
                      <div className="flex flex-wrap gap-2">
                        {results.matrix_metrics.hottest_columns.map((minute, index) => (
                          <Badge key={index} className="bg-orange-600 px-3 py-1">
                            :{minute.toString().padStart(2, '0')}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* Clusters Verticais */}
                    {results.matrix_metrics.vertical_clusters.length > 0 && (
                      <div>
                        <h3 className="font-semibold mb-3">📊 Clusters Verticais</h3>
                        <div className="space-y-2">
                          {results.matrix_metrics.vertical_clusters.slice(0, 5).map((cluster, index) => (
                            <div key={index} className="p-3 bg-blue-50 rounded-lg">
                              <div className="flex items-center justify-between">
                                <div>
                                  <span className="font-medium">Minuto :{cluster.minute.toString().padStart(2, '0')}</span>
                                  <span className="text-sm text-gray-600 ml-2">
                                    ({cluster.size} células consecutivas)
                                  </span>
                                </div>
                                <div className="text-sm text-gray-600">
                                  Horários: {cluster.hours.join(', ')}h
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Scenarios Tab */}
            <TabsContent value="scenarios">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Map className="h-5 w-5 text-purple-600" />
                    Mapeamento de Cenários
                  </CardTitle>
                  <CardDescription>
                    ODDs, placares e padrões temporais
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {/* Melhores Horários */}
                    <div>
                      <h3 className="font-semibold mb-3 flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-blue-600" />
                        Melhores Horários
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {results.scenario_mapping.best_hours.map((hour, index) => (
                          <Badge key={index} className="bg-blue-600 text-lg px-4 py-2">
                            {hour}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* Melhores Dias */}
                    <div>
                      <h3 className="font-semibold mb-3 flex items-center gap-2">
                        <Calendar className="h-5 w-5 text-green-600" />
                        Melhores Dias da Semana
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {results.scenario_mapping.best_days.map((day, index) => (
                          <Badge key={index} className="bg-green-600 px-4 py-2">
                            {day}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* Placares Mais Comuns */}
                    <div>
                      <h3 className="font-semibold mb-3">⚽ Placares Mais Comuns em Over 3.5</h3>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        {results.scenario_mapping.common_scores.map((score, index) => (
                          <div key={index} className="p-3 bg-gray-50 rounded-lg text-center border">
                            <div className="text-2xl font-bold text-blue-600">{score.score}</div>
                            <div className="text-xs text-gray-600">{score.count}x</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Sequências de Sucesso */}
                    <div>
                      <h3 className="font-semibold mb-3">✨ Sequências de Sucesso</h3>
                      <div className="space-y-2">
                        {results.scenario_mapping.success_sequences.map((seq, index) => (
                          <div key={index} className="p-3 bg-green-50 rounded-lg border-l-4 border-green-600">
                            <CheckCircle2 className="h-4 w-4 inline text-green-600 mr-2" />
                            {seq}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Insights Tab */}
            <TabsContent value="insights">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-yellow-600" />
                    Insights e Recomendações
                  </CardTitle>
                  <CardDescription>
                    Análise interpretativa e recomendações baseadas nos dados
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {/* Insights */}
                    <div>
                      <h3 className="font-semibold mb-3 text-lg">💡 Insights Identificados</h3>
                      <div className="space-y-3">
                        {results.insights.map((insight, index) => (
                          <div key={index} className="p-4 bg-blue-50 rounded-lg border-l-4 border-blue-600">
                            <p className="text-sm text-gray-700">{insight}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Recommendations */}
                    <div>
                      <h3 className="font-semibold mb-3 text-lg">✅ Recomendações</h3>
                      <div className="space-y-3">
                        {results.recommendations.map((rec, index) => (
                          <div key={index} className="p-4 bg-green-50 rounded-lg border-l-4 border-green-600">
                            <p className="text-sm text-gray-700">{rec}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
};

export default AdvancedAnalysisTab;

