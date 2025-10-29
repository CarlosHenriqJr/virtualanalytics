import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card.jsx';
import { Button } from './ui/button.jsx';
import { Input } from './ui/input.jsx';
import { Label } from './ui/label.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select.jsx';
import { Alert, AlertDescription } from './ui/alert.jsx';
import { Badge } from './ui/badge.jsx';
import { Progress } from './ui/progress.jsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs.jsx';
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
  const [maxEntries, setMaxEntries] = useState(1);

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
          max_entries: parseInt(maxEntries),
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

            {/* Max Entries (Gale) */}
            <div className="space-y-2">
              <Label htmlFor="max-entries">Máximo de Entradas (Gale)</Label>
              <Select value={String(maxEntries)} onValueChange={(val) => setMaxEntries(parseInt(val))}>
                <SelectTrigger id="max-entries">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 Entrada (Sem Gale)</SelectItem>
                  <SelectItem value="2">2 Entradas (Gale 1)</SelectItem>
                  <SelectItem value="3">3 Entradas (Gale 2)</SelectItem>
                  <SelectItem value="4">4 Entradas (Gale 3)</SelectItem>
                  <SelectItem value="5">5 Entradas (Gale 4)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                {maxEntries === 1 ? 'Sem Gale - apenas 1 tentativa' : `Com Gale - até ${maxEntries} tentativas antes de RED`}
              </p>
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
    </div>
  );
};

export default AdaptiveLearningTab;