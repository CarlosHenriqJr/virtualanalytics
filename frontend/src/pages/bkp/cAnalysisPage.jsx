/**
 * AnalysisPage.jsx - Versão com Status do Banco de Dados
 * 
 * Tela principal de análise de gatilhos para futebol virtual.
 * Inclui indicador visual de conexão com o banco de dados.
 */

import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

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
  
  // Estados de status do banco de dados
  const [dbStatus, setDbStatus] = useState({
    connected: false,
    checking: true,
    totalMatches: 0,
    error: null
  });

  // Verificar status do banco de dados ao montar o componente
  useEffect(() => {
    checkDatabaseStatus();
    loadMarkets();
  }, []);

  const checkDatabaseStatus = async () => {
    try {
      setDbStatus(prev => ({ ...prev, checking: true, error: null }));
      
      // Tentar acessar o endpoint de health check
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
        start_date: '2024-08-01',
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
      
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - lookbackDays);
      
      const response = await axios.get(`${API_BASE_URL}/analysis/matches`, {
        params: {
          start_date: startDate.toISOString().split('T')[0],
          end_date: referenceDate,
          limit: 100
        }
      });
      
      setMatchesList(response.data);
      setActiveTab('matches');
    } catch (err) {
      setError('Erro ao carregar jogos: ' + (err.response?.data?.detail || err.message));
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

        {/* Mensagem de Erro */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-red-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span className="text-red-800">{error}</span>
            </div>
          </div>
        )}

        {/* Painel de Controle */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Configurações de Análise</h2>
          <p className="text-gray-600 mb-6">Selecione os parâmetros para sua análise</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            {/* Seletor de Mercado */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Mercado</label>
              <select
                value={selectedMarket}
                onChange={(e) => setSelectedMarket(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={!dbStatus.connected}
              >
                <option value="">Selecione um mercado</option>
                {markets.map((market) => (
                  <option key={market} value={market}>
                    {market}
                  </option>
                ))}
              </select>
            </div>

            {/* Data de Referência */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Data de Referência</label>
              <input
                type="date"
                value={referenceDate}
                onChange={(e) => setReferenceDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={!dbStatus.connected}
              />
            </div>

            {/* Dias para Análise */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Dias para Análise</label>
              <input
                type="number"
                min="1"
                max="180"
                value={lookbackDays}
                onChange={(e) => setLookbackDays(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={!dbStatus.connected}
              />
            </div>

            {/* Botão de Ação */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">&nbsp;</label>
              <button
                onClick={handleTriggerAnalysis}
                disabled={loading || !selectedMarket || !dbStatus.connected}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-md transition-colors"
              >
                {loading ? 'Analisando...' : 'Analisar Gatilhos'}
              </button>
            </div>
          </div>

          {/* Botões Adicionais */}
          <div className="flex gap-2">
            <button
              onClick={handleHistoricalAnalysis}
              disabled={loading || !selectedMarket || !dbStatus.connected}
              className="bg-white hover:bg-gray-50 disabled:bg-gray-100 border border-gray-300 text-gray-700 font-semibold py-2 px-4 rounded-md transition-colors"
            >
              {loading ? 'Analisando...' : 'Análise Histórica'}
            </button>
            <button
              onClick={handleLoadMatches}
              disabled={loading || !selectedMarket || !dbStatus.connected}
              className="bg-white hover:bg-gray-50 disabled:bg-gray-100 border border-gray-300 text-gray-700 font-semibold py-2 px-4 rounded-md transition-colors"
            >
              {loading ? 'Carregando...' : 'Carregar Jogos'}
            </button>
          </div>
        </div>

        {/* Abas de Resultados */}
        <div className="bg-white rounded-lg shadow-md">
          {/* Cabeçalho das Abas */}
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              <button
                onClick={() => setActiveTab('trigger')}
                className={`py-4 px-6 font-medium text-sm border-b-2 transition-colors ${
                  activeTab === 'trigger'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Análise de Gatilhos
              </button>
              <button
                onClick={() => setActiveTab('historical')}
                className={`py-4 px-6 font-medium text-sm border-b-2 transition-colors ${
                  activeTab === 'historical'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Análise Histórica
              </button>
              <button
                onClick={() => setActiveTab('matches')}
                className={`py-4 px-6 font-medium text-sm border-b-2 transition-colors ${
                  activeTab === 'matches'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Jogos
              </button>
            </nav>
          </div>

          {/* Conteúdo das Abas */}
          <div className="p-6">
            {/* Aba 1: Análise de Gatilhos */}
            {activeTab === 'trigger' && (
              <div>
                {triggerAnalysis && triggerAnalysis.length > 0 ? (
                  <div>
                    <h3 className="text-xl font-semibold mb-4">Gatilhos Identificados</h3>
                    <p className="text-gray-600 mb-6">
                      Gatilhos mais efetivos para o mercado {selectedMarket}
                    </p>
                    <div className="space-y-4">
                      {triggerAnalysis.slice(0, 20).map((trigger, index) => (
                        <div key={index} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <h4 className="font-semibold text-gray-900">{trigger.trigger_name}</h4>
                              <p className="text-sm text-gray-600">
                                Taxa de sucesso: {(trigger.success_rate * 100).toFixed(2)}%
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold text-gray-900">
                                {trigger.successful_occurrences}/{trigger.total_occurrences}
                              </p>
                              <p className="text-sm text-gray-600">ocorrências</p>
                            </div>
                          </div>
                          {/* Barra de Progresso */}
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-blue-600 h-2 rounded-full transition-all"
                              style={{ width: `${trigger.success_rate * 100}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <p className="text-gray-500">
                      Nenhuma análise realizada. Clique em "Analisar Gatilhos" para começar.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Aba 2: Análise Histórica */}
            {activeTab === 'historical' && (
              <div>
                {historicalAnalysis && historicalAnalysis.length > 0 ? (
                  <div>
                    <h3 className="text-xl font-semibold mb-4">Detalhes por Período</h3>
                    <p className="text-gray-600 mb-6">
                      Evolução da efetividade do mercado {selectedMarket}
                    </p>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Período
                            </th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Total de Jogos
                            </th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Sucessos
                            </th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Taxa de Sucesso
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {historicalAnalysis.slice(0, 30).map((item, index) => (
                            <tr key={index} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {item.period}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-900">
                                {item.total_matches}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-900">
                                {item.successful_matches}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-900">
                                {(item.success_rate * 100).toFixed(2)}%
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <p className="text-gray-500">
                      Nenhuma análise histórica realizada. Clique em "Análise Histórica" para começar.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Aba 3: Lista de Jogos */}
            {activeTab === 'matches' && (
              <div>
                {matchesList && matchesList.length > 0 ? (
                  <div>
                    <h3 className="text-xl font-semibold mb-4">Jogos Carregados</h3>
                    <p className="text-gray-600 mb-6">
                      Total de {matchesList.length} jogos no período selecionado
                    </p>
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
                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                              HT
                            </th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                              FT
                            </th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Total de Gols
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {matchesList.map((match, index) => (
                            <tr key={index} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {match.date}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {match.timeCasa} vs {match.timeFora}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-900">
                                {match.placarHT}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-900">
                                {match.placarFT}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-900">
                                {match.totalGolsFT}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <p className="text-gray-500">
                      Nenhum jogo carregado. Clique em "Carregar Jogos" para começar.
                    </p>
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

