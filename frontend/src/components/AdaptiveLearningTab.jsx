import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Alert, AlertDescription } from './ui/alert';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Brain, TrendingUp, Target, Calendar, Settings, BarChart3, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';

const AdaptiveLearningTab = () => {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  
  // Form state
  const [targetMarket, setTargetMarket] = useState('TotalGols_MaisDe_35');
  const [startDate, setStartDate] = useState('2025-01-01');
  const [daysToAnalyze, setDaysToAnalyze] = useState(10);
  const [lookbackGames, setLookbackGames] = useState(10);

  const marketOptions = [
    { value: 'TotalGols_MaisDe_25', label: 'Over 2.5 Gols' },
    { value: 'TotalGols_MaisDe_35', label: 'Over 3.5 Gols' },
    { value: 'TotalGols_MaisDe_45', label: 'Over 4.5 Gols' },
    { value: 'TotalGols_MenosDe_25', label: 'Under 2.5 Gols' },
    { value: 'ParaOTimeMarcarSimNao_AmbasMarcam', label: 'Ambas Marcam' },
    { value: 'VencedorFT_Casa', label: 'Casa Vence' },
    { value: 'VencedorFT_Empate', label: 'Empate' },
    { value: 'VencedorFT_Visitante', label: 'Visitante Vence' },
  ];

  const handleAnalyze = async () => {
    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const response = await fetch('http://localhost:8000/adaptive-learning/daily-study', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          target_market: targetMarket,
          start_date: startDate,
          days_to_analyze: parseInt(daysToAnalyze),
          lookback_games: parseInt(lookbackGames),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Erro ao realizar análise');
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

  const getAccuracyBadge = (accuracy) => {
    if (accuracy >= 70) return <Badge className="bg-green-600">Excelente</Badge>;
    if (accuracy >= 50) return <Badge className="bg-yellow-600">Moderado</Badge>;
    return <Badge className="bg-red-600">Baixo</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Brain className="h-6 w-6 text-purple-600" />
            <CardTitle>Sistema de Aprendizado Adaptativo</CardTitle>
          </div>
          <CardDescription>
            Aprende padrões dia a dia, testa a eficiência e adapta automaticamente a estratégia
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Configuration Form */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            <CardTitle className="text-lg">Configuração da Análise</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Target Market */}
            <div className="space-y-2">
              <Label htmlFor="target-market">Mercado-Alvo</Label>
              <Select value={targetMarket} onValueChange={setTargetMarket}>
                <SelectTrigger id="target-market">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {marketOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Start Date */}
            <div className="space-y-2">
              <Label htmlFor="start-date">Data Inicial</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            {/* Days to Analyze */}
            <div className="space-y-2">
              <Label htmlFor="days">Dias para Analisar</Label>
              <Input
                id="days"
                type="number"
                min="3"
                max="90"
                value={daysToAnalyze}
                onChange={(e) => setDaysToAnalyze(e.target.value)}
              />
              <p className="text-xs text-gray-500">Recomendado: 7-30 dias</p>
            </div>

            {/* Lookback Games */}
            <div className="space-y-2">
              <Label htmlFor="lookback">Jogos Anteriores (Lookback)</Label>
              <Input
                id="lookback"
                type="number"
                min="3"
                max="50"
                value={lookbackGames}
                onChange={(e) => setLookbackGames(e.target.value)}
              />
              <p className="text-xs text-gray-500">Recomendado: 5-20 jogos</p>
            </div>
          </div>

          <Button
            onClick={handleAnalyze}
            disabled={loading}
            className="w-full mt-6"
          >
            {loading ? 'Analisando...' : 'Iniciar Análise Adaptativa'}
          </Button>
        </CardContent>
      </Card>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Results */}
      {results && (
        <div className="space-y-6">
          {/* Summary Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-blue-600" />
                  <CardTitle className="text-lg">Resumo da Análise</CardTitle>
                </div>
                {getAccuracyBadge(results.overall_accuracy)}
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className={`text-3xl font-bold ${getAccuracyColor(results.overall_accuracy)}`}>
                    {results.overall_accuracy.toFixed(1)}%
                  </div>
                  <div className="text-sm text-gray-600 mt-1">Acurácia Geral</div>
                </div>
                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <div className="text-3xl font-bold text-purple-600">
                    {results.total_days_analyzed}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">Dias Analisados</div>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-3xl font-bold text-green-600">
                    {results.learning_evolution.length}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">Padrões Aprendidos</div>
                </div>
                <div className="text-center p-4 bg-orange-50 rounded-lg">
                  <div className="text-3xl font-bold text-orange-600">
                    {results.validation_results.filter(v => !v.should_keep_pattern).length}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">Adaptações</div>
                </div>
              </div>

              <div className="mt-4">
                <div className="flex justify-between text-sm mb-2">
                  <span>Performance</span>
                  <span className={getAccuracyColor(results.overall_accuracy)}>
                    {results.overall_accuracy >= 70 ? 'Excelente' : results.overall_accuracy >= 50 ? 'Moderado' : 'Baixo'}
                  </span>
                </div>
                <Progress value={results.overall_accuracy} className="h-2" />
              </div>
            </CardContent>
          </Card>

          {/* Tabs for detailed results */}
          <Tabs defaultValue="recommendations" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="recommendations">Recomendações</TabsTrigger>
              <TabsTrigger value="features">Features</TabsTrigger>
              <TabsTrigger value="evolution">Evolução</TabsTrigger>
              <TabsTrigger value="validations">Validações</TabsTrigger>
            </TabsList>

            {/* Recommendations Tab */}
            <TabsContent value="recommendations">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Recomendações do Sistema</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {results.recommendations.map((rec, index) => (
                      <div key={index} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                        {rec.includes('✅') && <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />}
                        {rec.includes('⚠️') && <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />}
                        {rec.includes('❌') && <XCircle className="h-5 w-5 text-red-600 mt-0.5" />}
                        {rec.includes('🔍') && <Target className="h-5 w-5 text-blue-600 mt-0.5" />}
                        {rec.includes('📊') && <BarChart3 className="h-5 w-5 text-purple-600 mt-0.5" />}
                        <span className="text-sm">{rec}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Features Tab */}
            <TabsContent value="features">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Features Mais Importantes</CardTitle>
                  <CardDescription>
                    Características que mais influenciam na previsão do mercado
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {results.final_pattern && results.final_pattern.features && (
                    <div className="space-y-4">
                      {results.final_pattern.features.slice(0, 5).map((feature, index) => (
                        <div key={index} className="space-y-2">
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">{index + 1}</Badge>
                              <span className="font-medium">{feature.feature_name}</span>
                              <span className="text-sm text-gray-600">= {feature.feature_value}</span>
                            </div>
                            <Badge className="bg-purple-600">{feature.importance.toFixed(1)}%</Badge>
                          </div>
                          <Progress value={feature.importance} className="h-2" />
                          <p className="text-sm text-gray-600">{feature.description}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Evolution Tab */}
            <TabsContent value="evolution">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Evolução do Aprendizado</CardTitle>
                  <CardDescription>
                    Padrões identificados dia a dia
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {results.learning_evolution.map((pattern, index) => (
                      <div key={index} className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-blue-600" />
                            <span className="font-medium">{pattern.date}</span>
                          </div>
                          <Badge variant="outline">
                            {pattern.target_occurrences} ocorrências ({pattern.target_success_rate.toFixed(1)}%)
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-gray-600">Total de jogos:</span>
                            <span className="ml-2 font-medium">{pattern.total_games}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Taxa de sucesso:</span>
                            <span className="ml-2 font-medium">{pattern.target_success_rate.toFixed(1)}%</span>
                          </div>
                        </div>
                        {pattern.top_sequences && pattern.top_sequences.length > 0 && (
                          <div className="mt-3">
                            <span className="text-sm text-gray-600">Top sequências:</span>
                            <div className="flex flex-wrap gap-2 mt-1">
                              {pattern.top_sequences.slice(0, 3).map((seq, i) => (
                                <Badge key={i} variant="secondary" className="text-xs">
                                  {seq}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Validations Tab */}
            <TabsContent value="validations">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Resultados das Validações</CardTitle>
                  <CardDescription>
                    Performance dos padrões aplicados dia a dia
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {results.validation_results.map((validation, index) => (
                      <div key={index} className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-purple-600" />
                            <span className="font-medium">{validation.date}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {validation.should_keep_pattern ? (
                              <CheckCircle2 className="h-5 w-5 text-green-600" />
                            ) : (
                              <XCircle className="h-5 w-5 text-red-600" />
                            )}
                            <Badge className={validation.accuracy >= 60 ? 'bg-green-600' : 'bg-red-600'}>
                              {validation.accuracy.toFixed(1)}%
                            </Badge>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                          <div>
                            <span className="text-gray-600">Previsões:</span>
                            <span className="ml-2 font-medium">{validation.predictions_made}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Acertos:</span>
                            <span className="ml-2 font-medium text-green-600">
                              {validation.correct_predictions}
                            </span>
                          </div>
                        </div>
                        <Progress value={validation.accuracy} className="h-2 mb-2" />
                        <p className="text-sm text-gray-600 italic">{validation.adjustment_needed}</p>
                      </div>
                    ))}
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

export default AdaptiveLearningTab;

