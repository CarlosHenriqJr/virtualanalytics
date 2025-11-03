/**
 * AIInsightsDashboard.jsx - Dashboard de Insights da IA
 * 
 * Mostra O QUE a IA aprendeu:
 * - Melhor gatilho de entrada
 * - Regras extraídas
 * - Sweet spot de odds
 * - Melhores horários
 * - Feature importance
 */

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Target, TrendingUp, Clock, Award, Lightbulb,
  AlertCircle, CheckCircle, DollarSign, BarChart3
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, LineChart, Line
} from 'recharts';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

export default function AIInsightsDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [gatilho, setGatilho] = useState(null);
  const [regras, setRegras] = useState([]);
  const [featureImportance, setFeatureImportance] = useState([]);
  const [sweetSpot, setSweetSpot] = useState(null);
  const [temporalAnalysis, setTemporalAnalysis] = useState(null);

  useEffect(() => {
    loadInsights();
  }, []);

  const loadInsights = async () => {
    try {
      setLoading(true);
      setError(null);

      // Carregar melhor gatilho
      const gatilhoRes = await axios.get(`${API_BASE_URL}/ai/insights/best-gatilho`);
      setGatilho(gatilhoRes.data.gatilho);
      setRegras(gatilhoRes.data.regras);

      // Carregar feature importance
      const featRes = await axios.get(`${API_BASE_URL}/ai/insights/feature-importance`);
      const featData = Object.entries(featRes.data.top_10 || {}).map(([name, value]) => ({
        name: name.replace(/_/g, ' '),
        importance: (value * 100).toFixed(1)
      }));
      setFeatureImportance(featData);

      // Carregar sweet spot
      const sweetRes = await axios.get(`${API_BASE_URL}/ai/insights/odds-sweet-spot`);
      setSweetSpot(sweetRes.data.sweet_spot);

      // Carregar análise temporal
      const temporalRes = await axios.get(`${API_BASE_URL}/ai/insights/temporal-analysis`);
      setTemporalAnalysis(temporalRes.data.temporal_analysis);

    } catch (err) {
      console.error('Erro ao carregar insights:', err);
      if (err.response?.status === 400) {
        setError('IA ainda não foi treinada. Execute o treinamento primeiro!');
      } else {
        setError('Erro ao carregar insights: ' + (err.response?.data?.detail || err.message));
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Analisando conhecimento da IA...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="w-4 h-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg p-6">
        <div className="flex items-center gap-3">
          <Lightbulb className="w-10 h-10" />
          <div>
            <h1 className="text-3xl font-bold">💡 Insights da IA</h1>
            <p className="text-green-100">O que a IA aprendeu e como usar</p>
          </div>
        </div>
      </div>

      {/* MELHOR GATILHO - Destaque Principal */}
      {gatilho && (
        <Card className="border-4 border-green-500 shadow-lg">
          <CardHeader className="bg-green-50">
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Target className="w-8 h-8 text-green-600" />
              🎯 MELHOR GATILHO DE ENTRADA
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
              {/* Odd Ideal */}
              <div className="text-center p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg border-2 border-green-200">
                <DollarSign className="w-8 h-8 text-green-600 mx-auto mb-2" />
                <p className="text-sm text-gray-600 mb-1">Odd Ideal</p>
                <p className="text-4xl font-bold text-green-600">{gatilho.odd_ideal.toFixed(2)}</p>
                <p className="text-xs text-gray-500 mt-1">
                  Faixa: {gatilho.odd_min.toFixed(2)} - {gatilho.odd_max.toFixed(2)}
                </p>
              </div>

              {/* Ratio Ideal */}
              <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-lg border-2 border-blue-200">
                <BarChart3 className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                <p className="text-sm text-gray-600 mb-1">Ratio Over/Under</p>
                <p className="text-4xl font-bold text-blue-600">{gatilho.ratio_ideal.toFixed(2)}</p>
                <p className="text-xs text-gray-500 mt-1">
                  Faixa: {gatilho.ratio_min.toFixed(2)} - {gatilho.ratio_max.toFixed(2)}
                </p>
              </div>

              {/* Win Rate */}
              <div className="text-center p-4 bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg border-2 border-purple-200">
                <TrendingUp className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                <p className="text-sm text-gray-600 mb-1">Win Rate Esperado</p>
                <p className="text-4xl font-bold text-purple-600">{gatilho.win_rate_esperado.toFixed(1)}%</p>
                <p className="text-xs text-gray-500 mt-1">Com este gatilho</p>
              </div>

              {/* Stake */}
              <div className="text-center p-4 bg-gradient-to-br from-orange-50 to-yellow-50 rounded-lg border-2 border-orange-200">
                <Award className="w-8 h-8 text-orange-600 mx-auto mb-2" />
                <p className="text-sm text-gray-600 mb-1">Stake Preferido</p>
                <p className="text-4xl font-bold text-orange-600">{gatilho.stake_preferido}</p>
                <p className="text-xs text-gray-500 mt-1">Gestão ideal</p>
              </div>
            </div>

            {/* Melhores Horários */}
            <div className="p-4 bg-gray-50 rounded-lg mb-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-5 h-5 text-gray-600" />
                <h3 className="font-bold text-gray-700">🕐 Melhores Horários:</h3>
              </div>
              <div className="flex gap-2 flex-wrap">
                {gatilho.melhores_horarios.map((hour) => (
                  <span key={hour} className="px-3 py-1 bg-green-100 text-green-700 rounded-full font-medium">
                    {hour}h
                  </span>
                ))}
              </div>
            </div>

            {/* Regras Aprendidas */}
            <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border-2 border-green-200">
              <h3 className="font-bold text-green-900 mb-3 flex items-center gap-2">
                <CheckCircle className="w-5 h-5" />
                📋 Regras Aprendidas pela IA:
              </h3>
              <ul className="space-y-2">
                {regras.map((regra, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-green-600 font-bold">→</span>
                    <span className="text-gray-700">{regra}</span>
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Feature Importance */}
      {featureImportance.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>🧠 Features Mais Importantes</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={featureImportance} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis type="category" dataKey="name" width={150} />
                <Tooltip />
                <Bar dataKey="importance" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-4 p-4 bg-green-50 rounded-lg">
              <p className="text-sm text-gray-700">
                💡 <strong>Interpretação:</strong> Features com maior porcentagem têm mais peso nas decisões.
                A IA prioriza essas características ao decidir entrar ou pular.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sweet Spot de Odds */}
      {sweetSpot && sweetSpot.all_ranges && (
        <Card>
          <CardHeader>
            <CardTitle>🎯 Sweet Spot - Melhor Faixa de Odds</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4 p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
              <p className="text-lg font-bold text-blue-900">
                {sweetSpot.recommendation}
              </p>
            </div>

            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={sweetSpot.all_ranges}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis label={{ value: 'Win Rate (%)', angle: -90, position: 'insideLeft' }} />
                <Tooltip />
                <Bar dataKey="win_rate" fill="#3b82f6">
                  {sweetSpot.all_ranges.map((entry, index) => (
                    <Bar
                      key={`cell-${index}`}
                      fill={entry.range === sweetSpot.best_range.range ? '#10b981' : '#3b82f6'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-5 gap-2">
              {sweetSpot.all_ranges.map((range, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-lg text-center ${
                    range.range === sweetSpot.best_range.range
                      ? 'bg-green-100 border-2 border-green-500'
                      : 'bg-gray-50'
                  }`}
                >
                  <p className="text-sm font-medium text-gray-700">{range.label}</p>
                  <p className="text-xs text-gray-500">{range.range}</p>
                  <p className="text-lg font-bold text-gray-900">{range.win_rate.toFixed(1)}%</p>
                  <p className="text-xs text-gray-500">{range.total_matches} jogos</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Análise Temporal */}
      {temporalAnalysis && (
        <Card>
          <CardHeader>
            <CardTitle>🕐 Análise de Horários</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Melhores Horários */}
              <div>
                <h3 className="font-bold text-green-700 mb-3">✅ Top 5 Melhores Horários:</h3>
                {temporalAnalysis.best_hours.map((h, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-green-50 rounded-lg mb-2">
                    <div className="flex items-center gap-2">
                      <Clock className="w-5 h-5 text-green-600" />
                      <span className="font-bold text-gray-700">{h.hour}h</span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-green-600">{h.win_rate.toFixed(1)}%</p>
                      <p className="text-xs text-gray-500">{h.total} jogos</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Piores Horários */}
              <div>
                <h3 className="font-bold text-red-700 mb-3">⚠️ Piores Horários:</h3>
                {temporalAnalysis.worst_hours.map((h, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-red-50 rounded-lg mb-2">
                    <div className="flex items-center gap-2">
                      <Clock className="w-5 h-5 text-red-600" />
                      <span className="font-bold text-gray-700">{h.hour}h</span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-red-600">{h.win_rate.toFixed(1)}%</p>
                      <p className="text-xs text-gray-500">{h.total} jogos</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-gray-700">
                💡 <strong>Recomendação:</strong> {temporalAnalysis.recommendation}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Botão para Atualizar */}
      <div className="flex justify-center">
        <Button
          onClick={loadInsights}
          className="bg-green-600 hover:bg-green-700"
        >
          🔄 Atualizar Insights
        </Button>
      </div>

      {/* Explicação */}
      <Card className="bg-gradient-to-r from-purple-50 to-pink-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-purple-600" />
            Como Usar os Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm text-gray-700">
            <p>
              <strong>1. Melhor Gatilho:</strong> Use os valores de odd ideal e ratio como referência.
              Quando uma partida tem características próximas, é um bom momento para entrar.
            </p>
            <p>
              <strong>2. Horários:</strong> Priorize entrar nos horários da lista "Top 5 Melhores".
              Evite os piores horários, pois têm menor taxa de acerto.
            </p>
            <p>
              <strong>3. Sweet Spot:</strong> A faixa de odds marcada em verde tem o melhor win rate histórico.
              Procure jogos nessa faixa.
            </p>
            <p>
              <strong>4. Features:</strong> Entenda quais características a IA considera mais importantes.
              Isso ajuda a identificar manualmente boas oportunidades.
            </p>
            <p className="text-purple-900 font-bold mt-4">
              💡 Estes insights são extraídos do modelo treinado e representam padrões REAIS
              aprendidos dos dados históricos!
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}