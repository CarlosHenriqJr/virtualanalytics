/**
 * AnalysisPage.jsx
 * 
 * Tela principal de análise de gatilhos para futebol virtual.
 * Permite ao usuário:
 * 1. Selecionar um mercado (e.g., "Over 3.5")
 * 2. Analisar jogos anteriores para identificar gatilhos
 * 3. Visualizar a efetividade de gatilhos ao longo do tempo
 */

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle } from 'lucide-react';
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import AnalysisPage from './pages/AnalysisPage'; // Adicione esta linha


const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

export default function AnalysisPage() {
  // Estados para dados
  const [markets, setMarkets] = useState([]);
  const [selectedMarket, setSelectedMarket] = useState('');
  const [referenceDate, setReferenceDate] = useState(new Date().toISOString().split('T')[0]);
  const [lookbackDays, setLookbackDays] = useState(30);
  
  // Estados para resultados de análise
  const [triggerAnalysis, setTriggerAnalysis] = useState(null);
  const [historicalAnalysis, setHistoricalAnalysis] = useState(null);
  const [matchesList, setMatchesList] = useState([]);
  
  // Estados de UI
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('trigger');

  // Carregar mercados disponíveis ao montar o componente
  useEffect(() => {
    loadMarkets();
  }, []);

  const loadMarkets = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get(`${API_BASE_URL}/analysis/markets`);
      setMarkets(response.data.markets || []);
      
      // Selecionar o primeiro mercado por padrão
      if (response.data.markets && response.data.markets.length > 0) {
        setSelectedMarket(response.data.markets[0]);
      }
    } catch (err) {
      setError('Erro ao carregar mercados: ' + (err.response?.data?.detail || err.message));
      console.error('Erro ao carregar mercados:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerAnalysis = async () => {
    if (!selectedMarket) {
      setError('Por favor, selecione um mercado');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const response = await axios.post(`${API_BASE_URL}/analysis/trigger-analysis`, {
        market: selectedMarket,
        reference_date: referenceDate,
        lookback_days: parseInt(lookbackDays)
      });
      
      setTriggerAnalysis(response.data);
      setActiveTab('trigger');
    } catch (err) {
      setError('Erro ao analisar gatilhos: ' + (err.response?.data?.detail || err.message));
      console.error('Erro ao analisar gatilhos:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleHistoricalAnalysis = async () => {
    if (!selectedMarket) {
      setError('Por favor, selecione um mercado');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const response = await axios.post(`${API_BASE_URL}/analysis/historical-trigger-analysis`, {
        market: selectedMarket,
        start_date: '2024-08-01', // Início dos 6 meses de dados
        end_date: referenceDate,
        aggregation: 'daily'
      });
      
      setHistoricalAnalysis(response.data);
      setActiveTab('historical');
    } catch (err) {
      setError('Erro ao analisar histórico: ' + (err.response?.data?.detail || err.message));
      console.error('Erro ao analisar histórico:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadMatches = async () => {
    if (!selectedMarket) {
      setError('Por favor, selecione um mercado');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const response = await axios.post(`${API_BASE_URL}/analysis/matches`, null, {
        params: {
          start_date: new Date(new Date().setDate(new Date().getDate() - lookbackDays)).toISOString().split('T')[0],
          end_date: referenceDate,
          limit: 100
        }
      });
      
      setMatchesList(response.data);
    } catch (err) {
      setError('Erro ao carregar jogos: ' + (err.response?.data?.detail || err.message));
      console.error('Erro ao carregar jogos:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-6 space-y-6">
      {/* Cabeçalho */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Análise de Gatilhos</h1>
        <p className="text-gray-600">
          Analise dados históricos de futebol virtual para identificar os melhores gatilhos de entrada
        </p>
      </div>

      {/* Mensagem de Erro */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Painel de Controle */}
      <Card>
        <CardHeader>
          <CardTitle>Configurações de Análise</CardTitle>
          <CardDescription>Selecione os parâmetros para sua análise</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Seletor de Mercado */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Mercado</label>
              <Select value={selectedMarket} onValueChange={setSelectedMarket}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um mercado" />
                </SelectTrigger>
                <SelectContent className="max-h-[200px]">
                  {markets.map((market) => (
                    <SelectItem key={market} value={market}>
                      {market}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Data de Referência */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Data de Referência</label>
              <Input
                type="date"
                value={referenceDate}
                onChange={(e) => setReferenceDate(e.target.value)}
              />
            </div>

            {/* Dias para Análise */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Dias para Análise</label>
              <Input
                type="number"
                min="1"
                max="180"
                value={lookbackDays}
                onChange={(e) => setLookbackDays(e.target.value)}
              />
            </div>

            {/* Botão de Ação */}
            <div className="space-y-2">
              <label className="text-sm font-medium">&nbsp;</label>
              <Button
                onClick={handleTriggerAnalysis}
                disabled={loading || !selectedMarket}
                className="w-full"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Analisando...
                  </>
                ) : (
                  'Analisar Gatilhos'
                )}
              </Button>
            </div>
          </div>

          {/* Botões Adicionais */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              onClick={handleHistoricalAnalysis}
              disabled={loading || !selectedMarket}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analisando...
                </>
              ) : (
                'Análise Histórica'
              )}
            </Button>
            <Button
              variant="outline"
              onClick={handleLoadMatches}
              disabled={loading || !selectedMarket}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Carregando...
                </>
              ) : (
                'Carregar Jogos'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Abas de Resultados */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="trigger">Análise de Gatilhos</TabsTrigger>
          <TabsTrigger value="historical">Análise Histórica</TabsTrigger>
          <TabsTrigger value="matches">Jogos</TabsTrigger>
        </TabsList>

        {/* Aba 1: Análise de Gatilhos */}
        <TabsContent value="trigger" className="space-y-4">
          {triggerAnalysis && triggerAnalysis.length > 0 ? (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Gatilhos Identificados</CardTitle>
                  <CardDescription>
                    Gatilhos mais efetivos para o mercado {selectedMarket}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {triggerAnalysis.map((trigger, index) => (
                      <div key={index} className="border rounded-lg p-4 space-y-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-semibold">{trigger.trigger_name}</h3>
                            <p className="text-sm text-gray-600">
                              Taxa de sucesso: {(trigger.success_rate * 100).toFixed(2)}%
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold">{trigger.successful_occurrences}/{trigger.total_occurrences}</p>
                            <p className="text-sm text-gray-600">ocorrências</p>
                          </div>
                        </div>
                        
                        {/* Barra de Progresso */}
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-green-500 h-2 rounded-full"
                            style={{ width: `${trigger.success_rate * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-gray-500">
                  Nenhuma análise realizada. Clique em "Analisar Gatilhos" para começar.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Aba 2: Análise Histórica */}
        <TabsContent value="historical" className="space-y-4">
          {historicalAnalysis && historicalAnalysis.length > 0 ? (
            <div className="space-y-4">
              {/* Gráfico de Taxa de Sucesso */}
              <Card>
                <CardHeader>
                  <CardTitle>Taxa de Sucesso ao Longo do Tempo</CardTitle>
                  <CardDescription>
                    Evolução da efetividade do mercado {selectedMarket} por dia
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={historicalAnalysis}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="period" />
                      <YAxis />
                      <Tooltip
                        formatter={(value) => `${(value * 100).toFixed(2)}%`}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="success_rate"
                        stroke="#8884d8"
                        name="Taxa de Sucesso"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Tabela de Detalhes */}
              <Card>
                <CardHeader>
                  <CardTitle>Detalhes por Período</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 px-2">Período</th>
                          <th className="text-center py-2 px-2">Total de Jogos</th>
                          <th className="text-center py-2 px-2">Sucessos</th>
                          <th className="text-center py-2 px-2">Taxa de Sucesso</th>
                        </tr>
                      </thead>
                      <tbody>
                        {historicalAnalysis.map((item, index) => (
                          <tr key={index} className="border-b hover:bg-gray-50">
                            <td className="py-2 px-2">{item.period}</td>
                            <td className="text-center py-2 px-2">{item.total_matches}</td>
                            <td className="text-center py-2 px-2">{item.successful_matches}</td>
                            <td className="text-center py-2 px-2">
                              {(item.success_rate * 100).toFixed(2)}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-gray-500">
                  Nenhuma análise histórica realizada. Clique em "Análise Histórica" para começar.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Aba 3: Lista de Jogos */}
        <TabsContent value="matches" className="space-y-4">
          {matchesList && matchesList.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Jogos Carregados</CardTitle>
                <CardDescription>
                  Total de {matchesList.length} jogos no período selecionado
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-2">Data</th>
                        <th className="text-left py-2 px-2">Jogo</th>
                        <th className="text-center py-2 px-2">HT</th>
                        <th className="text-center py-2 px-2">FT</th>
                        <th className="text-center py-2 px-2">Total de Gols</th>
                      </tr>
                    </thead>
                    <tbody>
                      {matchesList.map((match, index) => (
                        <tr key={index} className="border-b hover:bg-gray-50">
                          <td className="py-2 px-2">{match.date}</td>
                          <td className="py-2 px-2">
                            {match.timeCasa} vs {match.timeFora}
                          </td>
                          <td className="text-center py-2 px-2">{match.placarHT}</td>
                          <td className="text-center py-2 px-2">{match.placarFT}</td>
                          <td className="text-center py-2 px-2">{match.totalGolsFT}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-gray-500">
                  Nenhum jogo carregado. Clique em "Carregar Jogos" para começar.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

