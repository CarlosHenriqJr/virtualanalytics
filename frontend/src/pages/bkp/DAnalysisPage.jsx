/**
 * AnalysisPage.jsx - Versão Final Corrigida
 * 
 * Correções:
 * - Dropdown de mercados agora carrega corretamente
 * - Data de referência limitada ao intervalo de datas disponíveis
 * - Botão "Analisar Gatilhos" totalmente funcional
 */

import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

export default function AnalysisPage() {
  // Estados para dados
  const [markets, setMarkets] = useState([]);
  const [selectedMarket, setSelectedMarket] = useState('');
  const [referenceDate, setReferenceDate] = useState('');
  const [lookbackDays, setLookbackDays] = useState(30);
  const [availableDates, setAvailableDates] = useState({ oldest: null, newest: null });
  
  // Estados para resultados de análise
  const [triggerAnalysis, setTriggerAnalysis] = useState(null);
  const [historicalAnalysis, setHistoricalAnalysis] = useState(null);
  const [matchesList, setMatchesList] = useState([]);
  
  // Estados de UI
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('trigger');
  
  // Estados de status do banco de dados
  const [dbStatus, setDbStatus] = useState({
    connected: false,
    checking: true,
    totalMatches: 0,
    error: null
  });

  // Verificar status do banco de dados e carregar dados iniciais
  useEffect(() => {
    const initialize = async () => {
      await checkDatabaseStatus();
      await loadMarkets();
      await loadAvailableDates();
    };
    initialize();
  }, []);

  const checkDatabaseStatus = async () => {
    try {
      setDbStatus(prev => ({ ...prev, checking: true, error: null }));
      
      const response = await axios.get(`${API_BASE_URL}/analysis/health`);
      
      setDbStatus({
        connected: true,
        checking: false,
        totalMatches: response.data.total_matches || 0,
        error: null
      });
    } catch (err) {
      setDbStatus({
        connected: false,
        checking: false,
        totalMatches: 0,
        error: err.response?.data?.detail || err.message || 'Erro ao conectar ao banco de dados'
      });
    }
  };

  const loadMarkets = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('Carregando mercados...');
      const response = await axios.get(`${API_BASE_URL}/analysis/markets`);
      console.log('Mercados recebidos:', response.data);
      
      const marketsList = response.data.markets || [];
      setMarkets(marketsList);
      
      // Selecionar o primeiro mercado por padrão
      if (marketsList.length > 0) {
        setSelectedMarket(marketsList[0]);
      }
    } catch (err) {
      const errorMsg = 'Erro ao carregar mercados: ' + (err.response?.data?.detail || err.message);
      setError(errorMsg);
      console.error('Erro ao carregar mercados:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableDates = async () => {
    try {
      console.log('Carregando datas disponíveis...');
      const response = await axios.get(`${API_BASE_URL}/analysis/dates`);
      console.log('Datas recebidas:', response.data);
      
      setAvailableDates({
        oldest: response.data.oldest_date,
        newest: response.data.newest_date
      });
      
      // Definir a data de referência como a mais recente disponível
      if (response.data.newest_date) {
        setReferenceDate(response.data.newest_date);
      }
    } catch (err) {
      console.error('Erro ao carregar datas:', err);
      // Se falhar, usar data atual
      setReferenceDate(new Date().toISOString().split('T')[0]);
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
      
      console.log('Analisando gatilhos para:', {
        market: selectedMarket,
        reference_date: referenceDate,
        lookback_days: lookbackDays
      });
      
      const response = await axios.post(`${API_BASE_URL}/analysis/trigger-analysis`, {
        market: selectedMarket,
        reference_date: referenceDate,
        lookback_days: parseInt(lookbackDays)
      });
      
      console.log('Resultado da análise:', response.data);
      setTriggerAnalysis(response.data);
      setActiveTab('trigger');
    } catch (err) {
      const errorMsg = 'Erro ao analisar gatilhos: ' + (err.response?.data?.detail || err.message);
      setError(errorMsg);
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
      
      const startDate = availableDates.oldest || '2024-08-01';
      
      console.log('Analisando histórico para:', {
        market: selectedMarket,
        start_date: startDate,
        end_date: referenceDate,
        aggregation: 'daily'
      });
      
      const response = await axios.post(`${API_BASE_URL}/analysis/historical-trigger-analysis`, {
        market: selectedMarket,
        start_date: startDate,
        end_date: referenceDate,
        aggregation: 'daily'
      });
      
      console.log('Resultado do histórico:', response.data);
      setHistoricalAnalysis(response.data);
      setActiveTab('historical');
    } catch (err) {
      const errorMsg = 'Erro ao analisar histórico: ' + (err.response?.data?.detail || err.message);
      setError(errorMsg);
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
      
      const startDate = new Date(referenceDate);
      startDate.setDate(startDate.getDate() - lookbackDays);
      
      console.log('Carregando jogos:', {
        start_date: startDate.toISOString().split('T')[0],
        end_date: referenceDate,
        limit: 100
      });
      
      const response = await axios.get(`${API_BASE_URL}/analysis/matches`, {
        params: {
          start_date: startDate.toISOString().split('T')[0],
          end_date: referenceDate,
          limit: 100
        }
      });
      
      console.log('Jogos carregados:', response.data.length);
      setMatchesList(response.data);
      setActiveTab('matches');
    } catch (err) {
      const errorMsg = 'Erro ao carregar jogos: ' + (err.response?.data?.detail || err.message);
      setError(errorMsg);
      console.error('Erro ao carregar jogos:', err);
    } finally {
      setLoading(false);
    }
  };

  // Componente de Status do Banco de Dados
  const DatabaseStatusBanner = () => {
    if (dbStatus.checking) {
      return (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-center">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mr-3"></div>
            <span className="text-blue-800 font-medium">Verificando conexão com o banco de dados...</span>
          </div>
        </div>
      );
    }

    if (dbStatus.connected) {
      return (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <svg className="w-6 h-6 text-green-600 mr-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <div>
                <span className="text-green-800 font-semibold">✓ Banco de Dados Conectado</span>
                <p className="text-green-700 text-sm mt-1">
                  {dbStatus.totalMatches > 0 
                    ? `${dbStatus.totalMatches.toLocaleString('pt-BR')} jogos disponíveis para análise`
                    : 'Banco de dados vazio - nenhum jogo encontrado'
                  }
                </p>
                {availableDates.oldest && availableDates.newest && (
                  <p className="text-green-600 text-xs mt-1">
                    Período: {availableDates.oldest} até {availableDates.newest}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={checkDatabaseStatus}
              className="text-green-700 hover:text-green-900 text-sm font-medium underline"
            >
              Atualizar
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <svg className="w-6 h-6 text-red-600 mr-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <div>
              <span className="text-red-800 font-semibold">✗ Erro na Conexão com o Banco de Dados</span>
              <p className="text-red-700 text-sm mt-1">{dbStatus.error}</p>
              <p className="text-red-600 text-xs mt-2">
                Verifique se o backend está rodando e se o MongoDB está acessível.
              </p>
            </div>
          </div>
          <button
            onClick={checkDatabaseStatus}
            className="text-red-700 hover:text-red-900 text-sm font-medium underline"
          >
            Tentar Novamente
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Cabeçalho */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Análise de Gatilhos</h1>
          <p className="mt-2 text-gray-600">
            Analise dados históricos de futebol virtual para identificar os melhores gatilhos de entrada
          </p>
        </div>

        {/* Banner de Status do Banco de Dados */}
        <DatabaseStatusBanner />

        {/* Painel de Configuração */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Configuração de Análise</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Seletor de Mercado */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Mercado
              </label>
              <select
                value={selectedMarket}
                onChange={(e) => setSelectedMarket(e.target.value)}
                disabled={!dbStatus.connected || loading || markets.length === 0}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                {markets.length === 0 ? (
                  <option value="">Carregando mercados...</option>
                ) : (
                  <>
                    <option value="">Selecione um mercado</option>
                    {markets.map((market) => (
                      <option key={market} value={market}>
                        {market}
                      </option>
                    ))}
                  </>
                )}
              </select>
              {markets.length > 0 && (
                <p className="text-xs text-gray-500 mt-1">
                  {markets.length} mercados disponíveis
                </p>
              )}
            </div>

            {/* Data de Referência */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Data de Referência
              </label>
              <input
                type="date"
                value={referenceDate}
                onChange={(e) => setReferenceDate(e.target.value)}
                min={availableDates.oldest || undefined}
                max={availableDates.newest || undefined}
                disabled={!dbStatus.connected || loading}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
              {availableDates.oldest && availableDates.newest && (
                <p className="text-xs text-gray-500 mt-1">
                  {availableDates.oldest} - {availableDates.newest}
                </p>
              )}
            </div>

            {/* Dias para Análise */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Dias para Análise
              </label>
              <input
                type="number"
                value={lookbackDays}
                onChange={(e) => setLookbackDays(e.target.value)}
                min="1"
                max="365"
                disabled={!dbStatus.connected || loading}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
              <p className="text-xs text-gray-500 mt-1">
                Analisar últimos {lookbackDays} dias
              </p>
            </div>

            {/* Botões de Ação */}
            <div className="flex flex-col gap-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Ações
              </label>
              <button
                onClick={handleTriggerAnalysis}
                disabled={!dbStatus.connected || loading || !selectedMarket}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Analisando...' : 'Analisar Gatilhos'}
              </button>
              <button
                onClick={handleHistoricalAnalysis}
                disabled={!dbStatus.connected || loading || !selectedMarket}
                className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                Análise Histórica
              </button>
            </div>
          </div>

          {/* Mensagem de Erro */}
          {error && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-md p-4">
              <div className="flex">
                <svg className="w-5 h-5 text-red-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span className="text-red-800 text-sm">{error}</span>
              </div>
            </div>
          )}
        </div>

        {/* Tabs de Resultados */}
        <div className="bg-white rounded-lg shadow">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              <button
                onClick={() => setActiveTab('trigger')}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'trigger'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Análise de Gatilhos
              </button>
              <button
                onClick={() => setActiveTab('historical')}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'historical'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Análise Histórica
              </button>
              <button
                onClick={handleLoadMatches}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'matches'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
                disabled={!dbStatus.connected || loading || !selectedMarket}
              >
                Lista de Jogos
              </button>
            </nav>
          </div>

          <div className="p-6">
            {/* Tab: Análise de Gatilhos */}
            {activeTab === 'trigger' && (
              <div>
                {triggerAnalysis === null ? (
                  <div className="text-center py-12 text-gray-500">
                    <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    <p className="text-lg">Selecione um mercado e clique em "Analisar Gatilhos"</p>
                    <p className="text-sm mt-2">Os melhores gatilhos serão exibidos aqui</p>
                  </div>
                ) : triggerAnalysis.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <svg className="w-16 h-16 mx-auto mb-4 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <p className="text-lg">Nenhum gatilho encontrado</p>
                    <p className="text-sm mt-2">Tente aumentar o período de análise ou selecionar outro mercado</p>
                  </div>
                ) : (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      Gatilhos Identificados para {selectedMarket}
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Gatilho
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Taxa de Sucesso
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Ocorrências
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Sucessos
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {triggerAnalysis.map((trigger, index) => (
                            <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                {trigger.trigger_name}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  trigger.success_rate >= 0.7 ? 'bg-green-100 text-green-800' :
                                  trigger.success_rate >= 0.5 ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-red-100 text-red-800'
                                }`}>
                                  {(trigger.success_rate * 100).toFixed(1)}%
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {trigger.total_occurrences}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {trigger.successful_occurrences}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tab: Análise Histórica */}
            {activeTab === 'historical' && (
              <div>
                {historicalAnalysis === null ? (
                  <div className="text-center py-12 text-gray-500">
                    <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                    </svg>
                    <p className="text-lg">Selecione um mercado e clique em "Análise Histórica"</p>
                    <p className="text-sm mt-2">A efetividade ao longo do tempo será exibida aqui</p>
                  </div>
                ) : historicalAnalysis.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <svg className="w-16 h-16 mx-auto mb-4 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <p className="text-lg">Nenhum dado histórico encontrado</p>
                    <p className="text-sm mt-2">Verifique o período selecionado</p>
                  </div>
                ) : (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      Efetividade Histórica de {selectedMarket}
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Período
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Taxa de Sucesso
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Total de Jogos
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Sucessos
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {historicalAnalysis.map((period, index) => (
                            <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                {period.period}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  period.success_rate >= 0.7 ? 'bg-green-100 text-green-800' :
                                  period.success_rate >= 0.5 ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-red-100 text-red-800'
                                }`}>
                                  {(period.success_rate * 100).toFixed(1)}%
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {period.total_matches}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {period.successful_matches}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tab: Lista de Jogos */}
            {activeTab === 'matches' && (
              <div>
                {matchesList.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="text-lg">Clique em "Lista de Jogos" para carregar</p>
                    <p className="text-sm mt-2">Os jogos do período selecionado serão exibidos aqui</p>
                  </div>
                ) : (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      Jogos Encontrados ({matchesList.length})
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Data
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Jogo
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Placar HT
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Placar FT
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Total Gols
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {matchesList.map((match, index) => (
                            <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {match.date}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                {match.timeCasa} vs {match.timeFora}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {match.placarHT}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {match.placarFT}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {match.totalGolsFT}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

